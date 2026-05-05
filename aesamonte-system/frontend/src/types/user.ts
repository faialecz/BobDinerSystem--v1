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
  purchases?: ModulePerms;
  supplier?: ModulePerms;
  reports?: ModulePerms;
  settings?: ModulePerms;
}

export interface UserInfo {
  employeeId:       number;
  employeeName:     string;
  employeeUsername: string;
  roleName:         string;
  roleId:           number;
  isSystem:         boolean;
  permissions:      UserPermissions;
  token:            string;
}
