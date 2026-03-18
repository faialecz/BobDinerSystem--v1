export interface ModulePerms {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_archive: boolean;
  can_export: boolean;
}

export interface UserPermissions {
  dashboard?: ModulePerms;
  sales?: ModulePerms;
  inventory?: ModulePerms;
  orders?: ModulePerms;
  supplier?: ModulePerms;
  reports?: ModulePerms;
  settings?: ModulePerms;
}

export interface UserInfo {
  employeeId: number;
  roleName: string;
  employeeName: string;
  permissions: UserPermissions;
  token: string;
}
