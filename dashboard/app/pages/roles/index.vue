```vue
<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { rbacService } from "~/services";
import type { Permission, Role, RoleWriteBody } from "~/types/api";
import { ApiError } from "~/utils/apiError";

definePageMeta({ permission: "roles.view" });

const { t, locale } = useI18n();
const { can } = useCan();
const app = useAppStore();

const canManage = can("roles.manage");

const roles = useResource(() => rbacService.roles());
const permissions = useResource(() => rbacService.permissions(), {
  immediate: can("permissions.view"),
});

const tab = ref<"list" | "matrix">("list");

const tabs = computed(() => [
  { key: "list" as const, label: t("roles.list") },
  { key: "matrix" as const, label: t("roles.matrix") },
]);

/* -------------------------------------------------------------------------- */
/* Display helpers                                                            */
/* -------------------------------------------------------------------------- */

const roleName = (role: Role) =>
  locale.value === "ar" ? role.name_ar : role.name_en;

const roleDescription = (role: Role) =>
  locale.value === "ar" ? role.description_ar : role.description_en;

const permName = (permission: Permission) =>
  locale.value === "ar" ? permission.name_ar : permission.name_en;

const permDescription = (permission: Permission) =>
  locale.value === "ar" ? permission.description_ar : permission.description_en;

const groupLabel = (permission: Permission) =>
  locale.value === "ar" ? permission.group_label_ar : permission.group_label_en;

/* -------------------------------------------------------------------------- */
/* Search / filters                                                           */
/* -------------------------------------------------------------------------- */

const search = ref("");
const roleFilter = ref<"all" | "system" | "custom">("all");

const filteredRoles = computed(() => {
  const query = search.value.trim().toLowerCase();

  return (roles.data.value ?? []).filter((role) => {
    const matchesSearch =
      !query ||
      roleName(role).toLowerCase().includes(query) ||
      role.slug.toLowerCase().includes(query) ||
      roleDescription(role)?.toLowerCase().includes(query);

    const matchesFilter =
      roleFilter.value === "all" ||
      (roleFilter.value === "system" && role.is_system) ||
      (roleFilter.value === "custom" && !role.is_system);

    return matchesSearch && matchesFilter;
  });
});

/* -------------------------------------------------------------------------- */
/* Permissions                                                                */
/* -------------------------------------------------------------------------- */

const allPermissions = computed<Permission[]>(() => {
  if (permissions.data.value?.length) {
    return permissions.data.value;
  }

  const seen = new Map<string, Permission>();

  for (const role of roles.data.value ?? []) {
    for (const permission of role.permissions ?? []) {
      if (!seen.has(permission.slug)) {
        seen.set(permission.slug, permission);
      }
    }
  }

  return [...seen.values()];
});

const groupedPermissions = computed(() => {
  const groups = new Map<string, { label: string; items: Permission[] }>();

  for (const permission of allPermissions.value) {
    if (!groups.has(permission.group)) {
      groups.set(permission.group, {
        label: groupLabel(permission),
        items: [],
      });
    }

    groups.get(permission.group)!.items.push(permission);
  }

  return [...groups.values()];
});

const permissionSearch = ref("");

const filteredPermissionGroups = computed(() => {
  const query = permissionSearch.value.trim().toLowerCase();

  if (!query) {
    return groupedPermissions.value;
  }

  return groupedPermissions.value
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (permission) =>
          permName(permission).toLowerCase().includes(query) ||
          permission.slug.toLowerCase().includes(query) ||
          permDescription(permission)?.toLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.items.length > 0);
});

function roleHas(roleSlug: string, permissionSlug: string): boolean {
  const role = (roles.data.value ?? []).find((item) => item.slug === roleSlug);

  return (
    role?.permissions?.some(
      (permission) => permission.slug === permissionSlug,
    ) ?? false
  );
}

/* -------------------------------------------------------------------------- */
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

const open = ref(false);
const editing = ref<Role | null>(null);
const saving = ref(false);
const fieldErrors = ref<Record<string, string[]>>({});

const form = reactive({
  name_en: "",
  name_ar: "",
  description_en: "",
  description_ar: "",
  permission_ids: [] as number[],
});

function resetForm() {
  Object.assign(form, {
    name_en: "",
    name_ar: "",
    description_en: "",
    description_ar: "",
    permission_ids: [],
  });

  fieldErrors.value = {};
  permissionSearch.value = "";
}

function openCreate() {
  editing.value = null;
  resetForm();
  open.value = true;
}

function openEdit(role: Role) {
  editing.value = role;

  Object.assign(form, {
    name_en: role.name_en,
    name_ar: role.name_ar,
    description_en: role.description_en ?? "",
    description_ar: role.description_ar ?? "",
    permission_ids: (role.permissions ?? []).map((permission) => permission.id),
  });

  fieldErrors.value = {};
  permissionSearch.value = "";
  open.value = true;
}

/* -------------------------------------------------------------------------- */
/* Permission selection                                                       */
/* -------------------------------------------------------------------------- */

function isGroupFullySelected(items: Permission[]) {
  return (
    items.length > 0 &&
    items.every((permission) => form.permission_ids.includes(permission.id))
  );
}

function selectedCount(items: Permission[]) {
  return items.filter((permission) =>
    form.permission_ids.includes(permission.id),
  ).length;
}

function toggleGroup(items: Permission[], checked: boolean) {
  const ids = new Set(form.permission_ids);

  for (const permission of items) {
    if (checked) {
      ids.add(permission.id);
    } else {
      ids.delete(permission.id);
    }
  }

  form.permission_ids = [...ids];
}

function selectAllPermissions() {
  form.permission_ids = allPermissions.value.map((permission) => permission.id);
}

function clearAllPermissions() {
  form.permission_ids = [];
}

const selectedPermissionsCount = computed(() => form.permission_ids.length);

/* -------------------------------------------------------------------------- */
/* Submit                                                                     */
/* -------------------------------------------------------------------------- */

async function submit() {
  if (saving.value) return;

  saving.value = true;
  fieldErrors.value = {};

  const body: RoleWriteBody = {
    name_en: form.name_en,
    name_ar: form.name_ar,
    description_en: form.description_en || null,
    description_ar: form.description_ar || null,
    permission_ids: form.permission_ids,
  };

  try {
    if (editing.value) {
      await rbacService.updateRole(editing.value.id, body);
      app.pushToast("success", t("roles.updated"));
    } else {
      await rbacService.createRole(body);
      app.pushToast("success", t("roles.created"));
    }

    open.value = false;
    roles.reload();
  } catch (e) {
    if (e instanceof ApiError && e.kind === "validation" && e.errors) {
      fieldErrors.value = e.errors;
    } else {
      app.pushToast(
        "error",
        e instanceof ApiError ? e.message : t("errors.genericBody"),
      );
    }
  } finally {
    saving.value = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

const deleting = ref<Role | null>(null);
const removing = ref(false);

async function confirmDelete() {
  if (!deleting.value || removing.value) return;

  removing.value = true;

  try {
    await rbacService.deleteRole(deleting.value.id);

    app.pushToast("success", t("roles.deleted"));

    deleting.value = null;
    roles.reload();
  } catch (e) {
    app.pushToast(
      "error",
      e instanceof ApiError ? e.message : t("errors.genericBody"),
    );
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <PageHeader :title="t('roles.title')" :subtitle="t('roles.subtitle')">
      <template v-if="canManage" #actions>
        <button
          type="button"
          class="btn btn-primary inline-flex items-center gap-2 shadow-sm"
          @click="openCreate"
        >
          <KtIcon name="plus" />
          {{ t("roles.create") }}
        </button>
      </template>
    </PageHeader>

    <!-- Tabs -->
    <div class="rounded-xl border border-input bg-card p-1 shadow-sm">
      <AppTabs v-model="tab" :tabs="tabs" />
    </div>

    <!-- Loading / Error -->
    <LoadingState v-if="roles.pending.value" :rows="6" />

    <ErrorState
      v-else-if="roles.error.value"
      :error="roles.error.value"
      @retry="roles.reload"
    />

    <!-- MATRIX -->
    <template v-else-if="tab === 'matrix'">
      <div class="rounded-xl border border-input bg-card shadow-sm">
        <div class="border-b border-input px-5 py-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"
            >
              <KtIcon name="shield-tick" class="text-primary" />
            </div>

            <div>
              <h3 class="font-semibold text-foreground">
                {{ t("roles.matrix") }}
              </h3>

              <p class="text-xs text-muted-foreground">
                {{ t("roles.matrixNote") }}
              </p>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="table-base min-w-[800px]">
            <thead>
              <tr>
                <th class="sticky start-0 z-10 bg-card text-start">
                  {{ t("roles.permissions") }}
                </th>

                <th
                  v-for="role in filteredRoles"
                  :key="role.id"
                  class="min-w-[130px] text-center"
                >
                  <div class="flex flex-col items-center gap-1">
                    <span class="font-semibold">
                      {{ roleName(role) }}
                    </span>

                    <StatusBadge
                      :label="
                        role.is_system
                          ? t('roles.systemBadge')
                          : t('roles.customBadge')
                      "
                      :tone="role.is_system ? 'primary' : 'info'"
                    />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              <template v-for="group in groupedPermissions" :key="group.label">
                <tr class="bg-secondary/30">
                  <td
                    :colspan="Math.max(filteredRoles.length + 1, 1)"
                    class="font-semibold text-foreground"
                  >
                    {{ group.label }}
                  </td>
                </tr>

                <tr
                  v-for="permission in group.items"
                  :key="permission.id ?? permission.slug"
                >
                  <td class="sticky start-0 bg-card">
                    <div>
                      <span class="font-medium text-foreground">
                        {{ permName(permission) }}
                      </span>

                      <p
                        v-if="permDescription(permission)"
                        class="mt-0.5 text-2xs text-muted-foreground"
                      >
                        {{ permDescription(permission) }}
                      </p>
                    </div>
                  </td>

                  <td
                    v-for="role in filteredRoles"
                    :key="role.id"
                    class="text-center"
                  >
                    <span
                      v-if="roleHas(role.slug, permission.slug)"
                      class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-success/10 text-success"
                      :title="t('roles.held')"
                    >
                      <KtIcon name="check" />
                    </span>

                    <span
                      v-else
                      class="text-muted-foreground/30"
                      :title="t('roles.notHeld')"
                    >
                      —
                    </span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- LIST -->
    <template v-else>
      <!-- Toolbar -->
      <div
        class="flex flex-col gap-3 rounded-xl border border-input bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between"
      >
        <div class="relative w-full md:max-w-md">
          <KtIcon
            name="search"
            class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <input
            v-model="search"
            type="search"
            class="input ps-10"
            :placeholder="t('common.search')"
          />
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn"
            :class="roleFilter === 'all' ? 'btn-primary' : 'btn-secondary'"
            @click="roleFilter = 'all'"
          >
            {{ t("common.all") }}
          </button>

          <button
            type="button"
            class="btn"
            :class="roleFilter === 'system' ? 'btn-primary' : 'btn-secondary'"
            @click="roleFilter = 'system'"
          >
            {{ t("roles.systemBadge") }}
          </button>

          <button
            type="button"
            class="btn"
            :class="roleFilter === 'custom' ? 'btn-primary' : 'btn-secondary'"
            @click="roleFilter = 'custom'"
          >
            {{ t("roles.customBadge") }}
          </button>
        </div>
      </div>

      <!-- Empty -->
      <div
        v-if="filteredRoles.length === 0"
        class="rounded-xl border border-dashed border-input bg-card px-6 py-14 text-center"
      >
        <div
          class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary"
        >
          <KtIcon name="shield-tick" class="text-muted-foreground" />
        </div>

        <h3 class="font-semibold text-foreground">
          {{ t("roles.noPermissionsAssigned") }}
        </h3>

        <p class="mt-1 text-sm text-muted-foreground">
          {{ t("common.noResults") }}
        </p>
      </div>

      <!-- Role Cards -->
      <div v-else class="grid gap-4 xl:grid-cols-2">
        <DataCard
          v-for="role in filteredRoles"
          :key="role.id"
          class="group overflow-hidden transition-shadow hover:shadow-md"
        >
          <template #header>
            <div class="flex min-w-0 items-start gap-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"
              >
                <KtIcon name="shield-tick" class="text-primary" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="truncate font-semibold text-foreground">
                    {{ roleName(role) }}
                  </h3>

                  <StatusBadge
                    :label="
                      role.is_system
                        ? t('roles.systemBadge')
                        : t('roles.customBadge')
                    "
                    :tone="role.is_system ? 'primary' : 'info'"
                  />
                </div>

                <code
                  class="mt-1 inline-block rounded-md bg-secondary px-2 py-0.5 text-2xs text-muted-foreground"
                >
                  {{ role.slug }}
                </code>
              </div>
            </div>
          </template>

          <template v-if="canManage" #headerActions>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="btn btn-ghost h-9 w-9 p-0"
                :title="t('common.edit')"
                @click="openEdit(role)"
              >
                <KtIcon name="edit" />
              </button>

              <button
                v-if="!role.is_system"
                type="button"
                class="btn btn-ghost h-9 w-9 p-0 text-destructive"
                :title="t('common.delete')"
                @click="deleting = role"
              >
                <KtIcon name="trash" />
              </button>
            </div>
          </template>

          <div class="space-y-4">
            <p
              v-if="roleDescription(role)"
              class="text-sm leading-6 text-muted-foreground"
            >
              {{ roleDescription(role) }}
            </p>

            <!-- Stats -->
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-lg bg-secondary/60 px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <KtIcon name="profile-2user" class="text-muted-foreground" />

                  <span class="text-xs text-muted-foreground">
                    {{
                      t("roles.usersCount", { count: role.users_count ?? 0 })
                    }}
                  </span>
                </div>
              </div>

              <div class="rounded-lg bg-secondary/60 px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <KtIcon name="key" class="text-muted-foreground" />

                  <span class="text-xs text-muted-foreground">
                    {{
                      t("roles.permissionsCount", {
                        count:
                          role.permissions_count ??
                          role.permissions?.length ??
                          0,
                      })
                    }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Permissions -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span
                  class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {{ t("roles.permissions") }}
                </span>
              </div>

              <p
                v-if="role.slug === 'guest'"
                class="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground"
              >
                {{ t("roles.guestExplanation") }}
              </p>

              <div
                v-else-if="role.permissions?.length"
                class="flex flex-wrap gap-1.5"
              >
                <span
                  v-for="permission in role.permissions.slice(0, 6)"
                  :key="permission.id"
                  class="rounded-md border border-primary/10 bg-primary/5 px-2.5 py-1 text-2xs font-medium text-primary"
                  :title="permDescription(permission) ?? ''"
                >
                  {{ permName(permission) }}
                </span>

                <span
                  v-if="role.permissions.length > 6"
                  class="rounded-md bg-secondary px-2.5 py-1 text-2xs font-medium text-muted-foreground"
                >
                  +{{ role.permissions.length - 6 }}
                </span>
              </div>

              <span v-else class="text-xs text-muted-foreground">
                {{ t("roles.noPermissionsAssigned") }}
              </span>
            </div>
          </div>
        </DataCard>
      </div>
    </template>

    <!-- CREATE / EDIT -->
    <AppModal
      v-model:open="open"
      :title="editing ? t('roles.edit') : t('roles.create')"
    >
      <form
        class="flex max-h-[75vh] flex-col"
        novalidate
        @submit.prevent="submit"
      >
        <div class="space-y-6 overflow-y-auto pe-1">
          <!-- Basic Information -->
          <section>
            <div class="mb-4">
              <h3 class="font-semibold text-foreground">
                {{ t("roles.title") }}
              </h3>

              <p class="mt-1 text-xs text-muted-foreground">
                {{ t("roles.subtitle") }}
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                :label="t('roles.nameEn')"
                :error="fieldErrors.name_en"
                required
              >
                <input v-model="form.name_en" class="input" required />
              </FormField>

              <FormField
                :label="t('roles.nameAr')"
                :error="fieldErrors.name_ar"
                required
              >
                <input
                  v-model="form.name_ar"
                  class="input"
                  dir="rtl"
                  required
                />
              </FormField>

              <FormField
                :label="t('roles.descriptionEn')"
                :error="fieldErrors.description_en"
              >
                <textarea
                  v-model="form.description_en"
                  class="input min-h-[90px] resize-y"
                  rows="3"
                />
              </FormField>

              <FormField
                :label="t('roles.descriptionAr')"
                :error="fieldErrors.description_ar"
              >
                <textarea
                  v-model="form.description_ar"
                  class="input min-h-[90px] resize-y"
                  rows="3"
                  dir="rtl"
                />
              </FormField>
            </div>
          </section>

          <!-- Permissions -->
          <section>
            <div
              class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <h3 class="font-semibold text-foreground">
                  {{ t("roles.permissions") }}
                </h3>

                <p class="mt-1 text-xs text-muted-foreground">
                  {{ selectedPermissionsCount }}
                  {{ t("roles.permissions") }}
                </p>
              </div>

              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn btn-secondary text-xs"
                  @click="selectAllPermissions"
                >
                  {{ t("common.selectAll") }}
                </button>

                <button
                  type="button"
                  class="btn btn-ghost text-xs"
                  @click="clearAllPermissions"
                >
                  {{ t("common.clear") }}
                </button>
              </div>
            </div>

            <!-- Search -->
            <div class="relative mb-4">
              <KtIcon
                name="search"
                class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />

              <input
                v-model="permissionSearch"
                class="input ps-10"
                :placeholder="t('common.search')"
              />
            </div>

            <!-- The section heading above already names this group. -->
            <FormField label="" :error="fieldErrors.permission_ids">
              <div class="space-y-3">
                <div
                  v-for="group in filteredPermissionGroups"
                  :key="group.label"
                  class="overflow-hidden rounded-xl border border-input bg-card"
                >
                  <!-- Group Header -->
                  <div
                    class="flex items-center justify-between border-b border-input bg-secondary/40 px-4 py-3"
                  >
                    <label class="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        :checked="isGroupFullySelected(group.items)"
                        class="h-4 w-4"
                        @change="
                          toggleGroup(
                            group.items,
                            ($event.target as HTMLInputElement).checked,
                          )
                        "
                      />

                      <span class="text-sm font-semibold text-foreground">
                        {{ group.label }}
                      </span>
                    </label>

                    <span
                      class="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary"
                    >
                      {{ selectedCount(group.items) }}/{{ group.items.length }}
                    </span>
                  </div>

                  <!-- Group Items -->
                  <div class="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                    <label
                      v-for="permission in group.items"
                      :key="permission.id"
                      class="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-input hover:bg-secondary/50"
                    >
                      <input
                        v-model="form.permission_ids"
                        type="checkbox"
                        :value="permission.id"
                        class="mt-0.5 h-4 w-4 shrink-0"
                      />

                      <span class="min-w-0">
                        <span class="block text-sm font-medium text-foreground">
                          {{ permName(permission) }}
                        </span>

                        <span
                          v-if="permDescription(permission)"
                          class="mt-0.5 block text-2xs leading-4 text-muted-foreground"
                        >
                          {{ permDescription(permission) }}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </FormField>
          </section>
        </div>
      </form>

      <template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            @click="open = false"
          >
            {{ t("common.cancel") }}
          </button>

          <button
            type="button"
            class="btn btn-primary min-w-[120px]"
            :disabled="saving"
            @click="submit"
          >
            <span v-if="saving">
              {{ t("common.saving") }}
            </span>

            <span v-else>
              {{ t("common.save") }}
            </span>
          </button>
        </div>
      </template>
    </AppModal>

    <!-- DELETE -->
    <ConfirmDialog
      :open="deleting !== null"
      :title="t('common.delete')"
      :message="
        deleting
          ? t('roles.deleteConfirm', {
              name: roleName(deleting),
            })
          : ''
      "
      tone="destructive"
      :busy="removing"
      @update:open="(v) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>
```
