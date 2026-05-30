import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { SplashScreen } from '@/features/auth/SplashScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { SetupPasswordScreen } from '@/features/auth/SetupPasswordScreen';
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { ForbiddenScreen } from '@/features/auth/ForbiddenScreen';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { UsersPage } from '@/features/users/UsersPage';
import { UserFormPage } from '@/features/users/UserFormPage';
import { OrganizationsPage } from '@/features/organizations/OrganizationsPage';
import { OrganizationFormPage } from '@/features/organizations/OrganizationFormPage';
import { SubscriptionsPage } from '@/features/subscriptions/SubscriptionsPage';
import { SubscriptionFormPage } from '@/features/subscriptions/SubscriptionFormPage';
import { SubscriptionDetailPage } from '@/features/subscriptions/SubscriptionDetailPage';
import { HelpThreadsPage } from '@/features/support/HelpThreadsPage';
import { NewSupportThreadPage } from '@/features/support/NewSupportThreadPage';
import { ThreadDetailPage as SupportThreadDetailPage } from '@/features/support/ThreadDetailPage';
import { SupportInboxPage } from '@/features/support/SupportInboxPage';
import { ContentPage } from '@/features/content/ContentPage';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { LicensePage } from '@/features/license/LicensePage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const router = createBrowserRouter([
  { path: '/', element: <SplashScreen /> },
  { path: '/login', element: <LoginScreen /> },
  { path: '/setup-password', element: <SetupPasswordScreen /> },
  { path: '/forgot-password', element: <ForgotPasswordScreen /> },
  { path: '/forbidden', element: <ForbiddenScreen /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/users/new', element: <UserFormPage /> },
          { path: '/users/:id/edit', element: <UserFormPage /> },
          { path: '/content', element: <ContentPage /> },
          { path: '/organizations', element: <OrganizationsPage /> },
          { path: '/organizations/new', element: <OrganizationFormPage /> },
          { path: '/organizations/:id/edit', element: <OrganizationFormPage /> },
          { path: '/subscriptions', element: <SubscriptionsPage /> },
          { path: '/subscriptions/new', element: <SubscriptionFormPage /> },
          { path: '/subscriptions/:id/edit', element: <SubscriptionFormPage /> },
          { path: '/subscriptions/:id/details', element: <SubscriptionDetailPage /> },
          { path: '/activity', element: <ActivityPage /> },
          { path: '/license', element: <LicensePage /> },
          { path: '/help', element: <HelpThreadsPage /> },
          { path: '/help/new', element: <NewSupportThreadPage /> },
          { path: '/help/:id', element: <SupportThreadDetailPage variant="org" /> },
          { path: '/support', element: <SupportInboxPage /> },
          { path: '/support/:id', element: <SupportThreadDetailPage variant="super" /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <SplashScreen /> },
]);
