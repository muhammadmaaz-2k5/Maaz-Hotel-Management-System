import { useSignOutMutation, apiSlice } from "../store/apiSlice";
import { store } from "../store";
import useAppContext from "../hooks/useAppContext";
import { goodbyeToast, getStoredDisplayName } from "../lib/toast-messages";
import { useNavigate } from "react-router-dom";
import { LogOut, Trash2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Google profile image if exists, otherwise Robohash avatar
const getAvatarUrl = () => {
  const image = localStorage.getItem("user_image");
  if (image) return image; // Google Gmail profile image
  const email = localStorage.getItem("user_email");
  const name = localStorage.getItem("user_name");
  const identifier = email || name || "user";
  return `https://robohash.org/${encodeURIComponent(identifier)}.png?size=80x80&set=set1`;
};

const SignOutButton = () => {
  const { showToast } = useAppContext();
  const navigate = useNavigate();

  const [signOut] = useSignOutMutation();

  const handleClearAuth = async () => {
    try {
      await signOut().unwrap();
      store.dispatch(apiSlice.util.invalidateTags(['User']));
      showToast({
        title: "Auth State Cleared",
        description: "Authentication state has been cleared. You can sign in again.",
        type: "SUCCESS",
      });
      navigate("/sign-in");
    } catch (error: any) {
      showToast({
        title: "Clear Auth Failed",
        description: error.data?.message || error.message || "An error occurred",
        type: "ERROR",
      });
    }
  };

  /** Dev util: wipe browser storage + RQ cache, soft-nav to sign-in (no hard reload) */
  const clearAllStorage = () => {
    localStorage.removeItem("session_id");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_image");
    store.dispatch(apiSlice.util.resetApiState());
    showToast({
      title: "Storage Cleared",
      description:
        "All browser storage and cached queries were cleared. Sign in again when ready.",
      type: "SUCCESS",
    });
    navigate("/sign-in");
  };

  const handleSignOut = async () => {
    // Capture name before signOut clears localStorage
    const displayName = getStoredDisplayName();
    showToast(goodbyeToast(displayName));
    
    try {
      await signOut().unwrap();
      store.dispatch(apiSlice.util.invalidateTags(['User']));
      navigate("/sign-in");
    } catch (error: any) {
      showToast({
        title: "Sign Out Failed",
        description: error.data?.message || error.message || "An error occurred",
        type: "ERROR",
      });
    }
  };

  const userEmail = localStorage.getItem("user_email");
  const userName = localStorage.getItem("user_name");
  const displayName = userName || userEmail || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full p-0.5 ring-2 ring-teal-400/80 hover:ring-teal-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-300"
          aria-label="Profile menu"
        >
          <img
            src={getAvatarUrl()}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = `https://robohash.org/${encodeURIComponent(displayName)}.png?size=80x80&set=set1`;
            }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-white" align="end">
        <DropdownMenuLabel>
          <p className="font-medium text-gray-700">{displayName}</p>
          {userEmail && (
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-primary-action">
          <LogOut className="w-4 h-4 " />
          Sign Out
        </DropdownMenuItem>

        {/* Development utilities - only show in development */}
        {!import.meta.env.PROD && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleClearAuth}
              className="text-red-600"
            >
              <Trash2 className="w-4 h-4 " />
              Clear Auth State
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={clearAllStorage}
              className="text-orange-600"
            >
              <RefreshCw className="w-4 h-4 " />
              Clear All Storage
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SignOutButton;
