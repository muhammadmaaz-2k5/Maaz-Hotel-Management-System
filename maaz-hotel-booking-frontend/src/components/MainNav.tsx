import { Button } from "./ui/button";
import UsernameMenu from "./UsernameMenu";
import { Link } from "react-router-dom";
import useAppContext from "../hooks/useAppContext";
import { getHotelsSearchUrl } from "../lib/nav-utils";
import { store } from "../store";
import { apiSlice } from "../store/apiSlice";

const NAV_AUTH_WIDTH = "min-w-[120px]";

const navLinkClass =
  "flex items-center text-sm font-normal text-white/90 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200";

const MainNav = () => {
  const { isLoggedIn } = useAppContext();

  // Prefetch owner lists on hover so destination chrome + data arrive faster
  const prefetchMyHotels = () => {
    if (!isLoggedIn) return;
    store.dispatch(apiSlice.endpoints.getMyHotels.initiate(undefined, { subscribe: false, forceRefetch: false }));
  };
  const prefetchMyBookings = () => {
    if (!isLoggedIn) return;
    store.dispatch(apiSlice.endpoints.getMyBookings.initiate(undefined, { subscribe: false, forceRefetch: false }));
  };
  const prefetchInsights = () => {
    if (!isLoggedIn) return;
    store.dispatch(apiSlice.endpoints.getBusinessDashboard.initiate(undefined, { subscribe: false, forceRefetch: false }));
  };

  return (
    <nav className="flex items-center gap-1 lg:gap-2">
      <Link to={getHotelsSearchUrl()} className={navLinkClass}>
        Hotels
      </Link>
      <Link
        to="/my-bookings"
        className={navLinkClass}
        onMouseEnter={prefetchMyBookings}
      >
        My Bookings
      </Link>
      <Link
        to="/business-insights"
        className={navLinkClass}
        onMouseEnter={prefetchInsights}
      >
        Business Insights
      </Link>
      <Link
        to="/my-hotels"
        className={navLinkClass}
        onMouseEnter={prefetchMyHotels}
      >
        My Hotels
      </Link>

      <div className={`flex items-center justify-end ${NAV_AUTH_WIDTH}`}>
        {isLoggedIn ? (
          <UsernameMenu />
        ) : (
          <Link to="/sign-in">
            <Button
              variant="ghost"
              className="text-sm font-normal bg-white text-primary-action hover:bg-primary-50 hover:text-primary-hover border-2 border-white/80"
            >
              Log In
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default MainNav;
