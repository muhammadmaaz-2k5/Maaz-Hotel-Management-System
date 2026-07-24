import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';
import { getApiBaseUrl } from '../lib/api-client';
import Cookies from 'js-cookie';
import {
  HotelSearchResponse,
  HotelType,
  PaymentIntentResponse,
  UserType,
  HotelWithBookingsType,
  BookingType,
  ReviewType,
} from "../../../shared/types";
import { RegisterFormData } from '../pages/Register';
import { SignInFormData } from '../pages/SignIn';
import { BookingFormData } from '../forms/BookingForm/BookingForm';

export type SearchParams = {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  adultCount?: string;
  childCount?: string;
  page?: string;
  facilities?: string[];
  types?: string[];
  stars?: string[];
  maxPrice?: string;
  sortOption?: string;
};

const snakeToCamel = (str: string): string => {
  if (str.startsWith('_')) return str;
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
};

const camelizeKeys = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      const camelKey = snakeToCamel(key);
      acc[camelKey] = camelizeKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

const baseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('session_id');
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const camelizedBaseQuery = async (args: any, api: any, extraOptions: any) => {
  const result = await baseQuery(args, api, extraOptions);
  if (result.data && typeof result.data === 'object') {
    result.data = camelizeKeys(result.data);
  }
  return result;
};

const baseQueryWithRetry = retry(
  async (args, api, extraOptions) => {
    const result = await camelizedBaseQuery(args, api, extraOptions);
    if (result.error && result.error.status === 401) {
      // Handle 401 unauthorized
      Cookies.remove('session_id');
      localStorage.removeItem('session_id');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_image');
    }
    return result;
  },
  { maxRetries: 2 }
);

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['User', 'Hotel', 'MyHotel', 'Booking', 'Review', 'Analytics', 'SystemStats'],
  endpoints: (builder) => ({
    // Auth & Users
    validateToken: builder.query<any, void>({
      query: () => '/api/auth/validate-token',
      providesTags: ['User'],
    }),
    getCurrentUser: builder.query<UserType, void>({
      query: () => '/api/users/me',
      providesTags: ['User'],
    }),
    register: builder.mutation<any, RegisterFormData>({
      query: (body) => ({
        url: '/api/users/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.token) localStorage.setItem('session_id', data.token);
          if (data?.userId) localStorage.setItem('user_id', data.userId);
          if (data?.user) {
            const { email, firstName, lastName } = data.user;
            if (email) localStorage.setItem('user_email', email);
            const name = [firstName, lastName].filter(Boolean).join(' ') || email;
            if (name) localStorage.setItem('user_name', name);
          }
        } catch { }
      },
    }),
    signIn: builder.mutation<any, SignInFormData>({
      query: (body) => ({
        url: '/api/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.token) localStorage.setItem('session_id', data.token);
          if (data?.userId) localStorage.setItem('user_id', data.userId);
          if (data?.user) {
            const { email, firstName, lastName } = data.user;
            if (email) localStorage.setItem('user_email', email);
            const name = [firstName, lastName].filter(Boolean).join(' ') || email;
            if (name) localStorage.setItem('user_name', name);
          }
        } catch { }
      },
    }),
    signOut: builder.mutation<any, void>({
      query: () => ({
        url: '/api/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['User', 'MyHotel', 'Booking'],
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
          localStorage.removeItem('session_id');
          localStorage.removeItem('user_id');
          localStorage.removeItem('user_email');
          localStorage.removeItem('user_name');
          localStorage.removeItem('user_image');
        } catch { }
      }
    }),

    // Hotels
    searchHotels: builder.query<HotelSearchResponse, SearchParams>({
      query: (searchParams) => {
        const queryParams = new URLSearchParams();
        if (searchParams.destination && searchParams.destination.trim()) {
          queryParams.append("destination", searchParams.destination.trim());
        }
        if (searchParams.checkIn) queryParams.append("checkIn", searchParams.checkIn);
        if (searchParams.checkOut) queryParams.append("checkOut", searchParams.checkOut);
        if (searchParams.adultCount) queryParams.append("adultCount", searchParams.adultCount);
        if (searchParams.childCount) queryParams.append("childCount", searchParams.childCount);
        if (searchParams.page) queryParams.append("page", searchParams.page);
        if (searchParams.maxPrice) queryParams.append("maxPrice", searchParams.maxPrice);
        if (searchParams.sortOption) queryParams.append("sortOption", searchParams.sortOption);
        searchParams.facilities?.forEach((f) => queryParams.append("facilities", f));
        searchParams.types?.forEach((t) => queryParams.append("types", t));
        searchParams.stars?.forEach((s) => queryParams.append("stars", s));
        return `/api/hotels/search?${queryParams.toString()}`;
      },
    }),
    getHotels: builder.query<HotelType[], void>({
      query: () => '/api/hotels',
      providesTags: ['Hotel'],
    }),
    getHotelById: builder.query<HotelType, string>({
      query: (id) => `/api/hotels/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Hotel', id }],
    }),

    // My Hotels
    getMyHotels: builder.query<HotelType[], void>({
      query: () => '/api/my-hotels',
      providesTags: ['MyHotel'],
    }),
    getMyHotelById: builder.query<HotelType, string>({
      query: (id) => `/api/my-hotels/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'MyHotel', id }],
    }),
    addMyHotel: builder.mutation<any, FormData>({
      query: (body) => ({
        url: '/api/my-hotels',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyHotel', 'Hotel'],
    }),
    updateMyHotel: builder.mutation<any, FormData>({
      query: (body) => {
        const hotelId = body.get('hotelId');
        return {
          url: `/api/my-hotels/${hotelId}`,
          method: 'PUT',
          body,
        };
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: 'MyHotel', id: arg.get('hotelId') as string },
        'MyHotel',
        'Hotel'
      ],
    }),

    // Bookings
    createPaymentIntent: builder.mutation<PaymentIntentResponse, { hotelId: string; numberOfNights: string }>({
      query: ({ hotelId, numberOfNights }) => ({
        url: `/api/hotels/${hotelId}/bookings/payment-intent`,
        method: 'POST',
        body: { numberOfNights },
      }),
    }),
    createRoomBooking: builder.mutation<any, BookingFormData>({
      query: (body) => ({
        url: `/api/hotels/${body.hotelId}/bookings`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Booking', 'Hotel'],
    }),
    getMyBookings: builder.query<HotelWithBookingsType[], void>({
      query: () => '/api/my-bookings',
      providesTags: ['Booking'],
    }),
    getHotelBookings: builder.query<BookingType[], string>({
      query: (hotelId) => `/api/bookings/hotel/${hotelId}`,
      providesTags: ['Booking'],
    }),
    cancelBooking: builder.mutation<any, { bookingId: string, payload?: { cancellationReason?: string } }>({
      query: ({ bookingId, payload }) => ({
        url: `/api/bookings/${bookingId}/cancel`,
        method: 'POST',
        body: payload || {},
      }),
      invalidatesTags: ['Booking'],
    }),

    // Reviews
    getHotelReviews: builder.query<any, string>({
      query: (hotelId) => `/api/reviews/hotel/${hotelId}`,
      providesTags: (_result, _error, id) => [{ type: 'Review', id }],
    }),
    createHotelReview: builder.mutation<any, any>({
      query: (body) => ({
        url: '/api/reviews',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Review', id: arg.hotelId }],
    }),

    // Business Insights
    getBusinessDashboard: builder.query<any, void>({
      query: () => '/api/business-insights/dashboard/public',
    }),
    getAdminBusinessDashboard: builder.query<any, void>({
      query: () => '/api/business-insights/dashboard',
    }),
    getBusinessForecast: builder.query<any, void>({
      query: () => '/api/business-insights/forecast/public',
    }),
    getBusinessSystemStats: builder.query<any, void>({
      query: () => '/api/business-insights/system-stats/public',
    }),
    getBusinessRollups: builder.query<any[], void>({
      query: () => '/api/business-insights/rollups',
      providesTags: ['Analytics'],
    }),
    createBusinessRollup: builder.mutation<any, void>({
      query: () => ({
        url: '/api/business-insights/rollups',
        method: 'POST',
      }),
      invalidatesTags: ['Analytics'],
    }),

    // Admin Users
    getAdminUsers: builder.query<UserType[], void>({
      query: () => '/api/users',
      providesTags: ['User'],
    }),
    updateUserRole: builder.mutation<UserType, { userId: string, role: string }>({
      query: ({ userId, role }) => ({
        url: `/api/users/${userId}/role`,
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: ['User'],
    }),

    // Admin / Owner Status
    updateHotelActive: builder.mutation<HotelType, { hotelId: string, isActive: boolean }>({
      query: ({ hotelId, isActive }) => ({
        url: `/api/hotels/${hotelId}/active`,
        method: 'PATCH',
        body: { isActive },
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Hotel', id: arg.hotelId }, 'Hotel', 'MyHotel'],
    }),
    updateMyHotelActive: builder.mutation<HotelType, { hotelId: string, isActive: boolean }>({
      query: ({ hotelId, isActive }) => ({
        url: `/api/my-hotels/${hotelId}/active`,
        method: 'PATCH',
        body: { isActive },
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'MyHotel', id: arg.hotelId }, 'Hotel', 'MyHotel'],
    }),

    // Admin Misc
    getAdminBookings: builder.query<BookingType[], void>({
      query: () => '/api/bookings',
      providesTags: ['Booking'],
    }),
    getAdminReviews: builder.query<ReviewType[], void>({
      query: () => '/api/reviews',
      providesTags: ['Review'],
    }),

    // Health
    getHealth: builder.query<any, void>({
      query: () => '/api/health',
    }),
    getDetailedHealth: builder.query<any, void>({
      query: () => '/api/health/detailed',
    }),

    // AI
    suggestAiAssist: builder.mutation<any, any>({
      query: (body) => ({
        url: '/api/ai/suggest',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useValidateTokenQuery,
  useGetCurrentUserQuery,
  useRegisterMutation,
  useSignInMutation,
  useSignOutMutation,
  useSearchHotelsQuery,
  useGetHotelsQuery,
  useGetHotelByIdQuery,
  useGetMyHotelsQuery,
  useGetMyHotelByIdQuery,
  useAddMyHotelMutation,
  useUpdateMyHotelMutation,
  useCreatePaymentIntentMutation,
  useCreateRoomBookingMutation,
  useGetMyBookingsQuery,
  useGetHotelBookingsQuery,
  useCancelBookingMutation,
  useGetHotelReviewsQuery,
  useCreateHotelReviewMutation,
  useGetBusinessDashboardQuery,
  useGetAdminBusinessDashboardQuery,
  useGetBusinessForecastQuery,
  useGetBusinessSystemStatsQuery,
  useGetBusinessRollupsQuery,
  useCreateBusinessRollupMutation,
  useGetAdminUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateHotelActiveMutation,
  useUpdateMyHotelActiveMutation,
  useGetAdminBookingsQuery,
  useGetAdminReviewsQuery,
  useGetHealthQuery,
  useGetDetailedHealthQuery,
  useSuggestAiAssistMutation,
} = apiSlice;
