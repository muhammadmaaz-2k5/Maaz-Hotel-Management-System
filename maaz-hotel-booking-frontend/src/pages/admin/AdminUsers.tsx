import { useMemo } from "react";
import { useGetAdminUsersQuery, useUpdateUserRoleMutation } from "../../store/apiSlice";
import type { ColumnDef } from "@tanstack/react-table";
import type { UserType } from "../../../../shared/types";

import useAppContext from "../../hooks/useAppContext";
import { DataTable } from "../../components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { SelectOptionLabel } from "../../components/ui/select-option-label";
import type { LucideIcon } from "lucide-react";
import { Crown, Shield, User } from "lucide-react";

const ROLES = ["user", "admin", "hotel_owner"] as const;

const ROLE_ICONS: Record<(typeof ROLES)[number], LucideIcon> = {
  user: User,
  admin: Shield,
  hotel_owner: Crown,
};

const AdminUsers = () => {
  const { showToast } = useAppContext();
  const { data: users, isLoading } = useGetAdminUsersQuery();

  const [updateRole, { isLoading: isUpdating }] = useUpdateUserRoleMutation();

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await updateRole({ userId, role }).unwrap();
      showToast({
        title: "Role updated",
        description: "User role saved. Admin lists stay in sync.",
        type: "SUCCESS",
      });
    } catch (error) {
      showToast({
        title: "Failed to update role",
        description: "Please try again in a moment.",
        type: "ERROR",
      });
    }
  };

  const columns = useMemo<ColumnDef<UserType, unknown>[]>(
    () => [
      {
        accessorKey: "firstName",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
      },
      {
        id: "role",
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <Select
              value={u.role || "user"}
              disabled={isUpdating}
              onValueChange={(role) => handleUpdateRole(u._id, role)}
            >
              <SelectTrigger
                className="h-8 w-[140px]"
                aria-label={`Role for ${u.email}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    <SelectOptionLabel icon={ROLE_ICONS[r]}>{r}</SelectOptionLabel>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        accessorKey: "totalBookings",
        header: "Bookings",
        cell: ({ row }) => row.original.totalBookings ?? 0,
      },
      {
        id: "active",
        accessorFn: (u) => (u.isActive === false ? "No" : "Yes"),
        header: "Active",
      },
    ],
    [isUpdating],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg md:text-2xl font-medium text-gray-700">Users</h1>
        <p className="text-sm text-gray-500">Registered accounts</p>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-slate-200 animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users || []}
          searchPlaceholder="Search users…"
        />
      )}
    </div>
  );
};

export default AdminUsers;
