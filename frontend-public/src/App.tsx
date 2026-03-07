import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";

import Layout from "@/components/Layout";
import { AdminAppOnly, RequireAdminAccess, RequireAuth, RequireWriterApproved, RequireWriterRole, UserAppOnly } from "@/components/guards";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/components/theme-provider";

import AdminAuditLogsPage from "@/pages/AdminAuditLogsPage";
import AdminContentReviewPage from "@/pages/AdminContentReviewPage";
import AdminContentReadPage from "@/pages/AdminContentReadPage";
import AdminHomePage from "@/pages/AdminHomePage";
import AdminRedactorsPage from "@/pages/AdminRedactorsPage";
import AdminWriterApplicationsPage from "@/pages/AdminWriterApplicationsPage";
import DashboardPage from "@/pages/DashboardPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import FollowingFeedPage from "@/pages/FollowingFeedPage";
import LoginPage from "@/pages/LoginPage";
import LogoutPage from "@/pages/LogoutPage";
import MyWorksPage from "@/pages/MyWorksPage";
import NotFound from "@/pages/NotFound";
import NotificationsPage from "@/pages/NotificationsPage";
import PublicBrowsePage from "@/pages/PublicBrowsePage";
import PublicHomePage from "@/pages/PublicHomePage";
import PublicAuthorProfilePage from "@/pages/PublicAuthorProfilePage";
import PublicAuthorsPage from "@/pages/PublicAuthorsPage";
import PublicReadPage from "@/pages/PublicReadPage";
import PublishBookPage from "@/pages/PublishBookPage";
import ReaderBookDetailPage from "@/pages/ReaderBookDetailPage";
import ReaderChapterReadPage from "@/pages/ReaderChapterReadPage";
import ReaderTextWorkPage from "@/pages/ReaderTextWorkPage";
import ReaderWorksListPage from "@/pages/ReaderWorksListPage";
import RegisterPage from "@/pages/RegisterPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import SettingsPage from "@/pages/SettingsPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import WriterApplicationPage from "@/pages/WriterApplicationPage";
import WriterAnalyticsPage from "@/pages/WriterAnalyticsPage";
import WriterBookChaptersPage from "@/pages/WriterBookChaptersPage";
import WriterBookEditorPage from "@/pages/WriterBookEditorPage";
// WriterChapterEditorPage is deprecated
import WriterCreateWorkRedirectPage from "@/pages/WriterCreateWorkRedirectPage";
import WriterNewWorkPage from "@/pages/WriterNewWorkPage";
import WriterTextWorkEditorPage from "@/pages/WriterTextWorkEditorPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 1;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="vite-ui-theme">
      <I18nProvider>
        <TooltipProvider>
          <ConfirmProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Routes>
                <Route
                  path="/login"
                  element={
                    <UserAppOnly>
                      <LoginPage />
                    </UserAppOnly>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <UserAppOnly>
                      <RegisterPage />
                    </UserAppOnly>
                  }
                />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/logout"
                  element={
                    <RequireAuth>
                      <LogoutPage />
                    </RequireAuth>
                  }
                />

                <Route
                  path="/admin/login"
                  element={
                    <AdminAppOnly>
                      <LoginPage />
                    </AdminAppOnly>
                  }
                />
                <Route
                  path="/admin/verify-email"
                  element={
                    <AdminAppOnly>
                      <VerifyEmailPage />
                    </AdminAppOnly>
                  }
                />

                <Route element={<Layout />}>
                  <Route
                    path="/"
                    element={
                      <UserAppOnly>
                        <PublicHomePage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/browse"
                    element={
                      <UserAppOnly>
                        <PublicBrowsePage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/authors"
                    element={
                      <UserAppOnly>
                        <PublicAuthorsPage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/browse/authors"
                    element={
                      <UserAppOnly>
                        <PublicAuthorsPage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/authors/:authorKey"
                    element={
                      <UserAppOnly>
                        <PublicAuthorProfilePage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/browse/authors/:authorKey"
                    element={
                      <UserAppOnly>
                        <PublicAuthorProfilePage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/read/:category/:identifier"
                    element={
                      <UserAppOnly>
                        <PublicReadPage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/read/:category/:identifier/:page"
                    element={
                      <UserAppOnly>
                        <PublicReadPage />
                      </UserAppOnly>
                    }
                  />

                  <Route
                    path="/books"
                    element={
                      <UserAppOnly>
                        <ReaderWorksListPage category="books" />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/books/:identifier"
                    element={
                      <UserAppOnly>
                        <ReaderBookDetailPage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/books/:identifier/chapters/:chapterId"
                    element={
                      <UserAppOnly>
                        <ReaderChapterReadPage />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/poems"
                    element={
                      <UserAppOnly>
                        <ReaderWorksListPage category="poems" />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/poems/:identifier"
                    element={
                      <UserAppOnly>
                        <ReaderTextWorkPage type="poems" />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/stories"
                    element={
                      <UserAppOnly>
                        <ReaderWorksListPage category="stories" />
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/stories/:identifier"
                    element={
                      <UserAppOnly>
                        <ReaderTextWorkPage type="stories" />
                      </UserAppOnly>
                    }
                  />

                  <Route
                    path="/dashboard"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <DashboardPage />
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <NotificationsPage />
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/following"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <FollowingFeedPage />
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer-application"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <WriterApplicationPage />
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/my-works"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterRole>
                            <MyWorksPage />
                          </RequireWriterRole>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />

                  <Route
                    path="/writer/new"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterNewWorkPage />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/dashboard"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <MyWorksPage />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/analytics"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterAnalyticsPage />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/books/new"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterCreateWorkRedirectPage type="books" />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/books/:id/edit"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterBookEditorPage />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/books/:id/chapters"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterBookChaptersPage />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/chapters/:id/edit"
                    element={<Navigate to="/my-works" replace />}
                  />
                  <Route
                    path="/writer/poems/new"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterCreateWorkRedirectPage type="poems" />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/poems/:id/edit"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterTextWorkEditorPage type="poems" />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/stories/new"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterCreateWorkRedirectPage type="stories" />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/writer/stories/:id/edit"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <WriterTextWorkEditorPage type="stories" />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />

                  <Route
                    path="/publish/book"
                    element={
                      <UserAppOnly>
                        <RequireAuth>
                          <RequireWriterApproved>
                            <PublishBookPage />
                          </RequireWriterApproved>
                        </RequireAuth>
                      </UserAppOnly>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <RequireAuth>
                        <SettingsPage />
                      </RequireAuth>
                    }
                  />

                  <Route
                    path="/admin"
                    element={
                      <AdminAppOnly>
                        <RequireAuth>
                          <RequireAdminAccess>
                            <AdminHomePage />
                          </RequireAdminAccess>
                        </RequireAuth>
                      </AdminAppOnly>
                    }
                  />
                  <Route
                    path="/admin/settings"
                    element={
                      <AdminAppOnly>
                        <RequireAuth>
                          <SettingsPage />
                        </RequireAuth>
                      </AdminAppOnly>
                    }
                  />
                  <Route
                    path="/admin/redactors"
                    element={
                      <AdminAppOnly>
                        <RequireAuth>
                          <RequireAdminAccess>
                            <AdminRedactorsPage />
                          </RequireAdminAccess>
                        </RequireAuth>
                      </AdminAppOnly>
                    }
                  />
                  <Route
                    path="/admin/writer-applications"
                    element={
                      <AdminAppOnly>
                        <RequireAuth>
                          <RequireAdminAccess>
                            <AdminWriterApplicationsPage />
                          </RequireAdminAccess>
                        </RequireAuth>
                      </AdminAppOnly>
                    }
                  />
                  <Route
                    path="/admin/content-review"
                    element={
                      <AdminAppOnly>
                        <RequireAuth>
                          <RequireAdminAccess>
                            <AdminContentReviewPage />
                          </RequireAdminAccess>
                        </RequireAuth>
                      </AdminAppOnly>
                    }
                  />
                  <Route
                    path="/admin/content-review/:category/:id"
                    element={
                      <AdminAppOnly>
                        <RequireAuth>
                          <RequireAdminAccess>
                            <AdminContentReadPage />
                          </RequireAdminAccess>
                        </RequireAuth>
                      </AdminAppOnly>
                    }
                  />
                  <Route
                    path="/admin/audit-logs"
                    element={
                      <AdminAppOnly>
                        <RequireAuth>
                          <RequireAdminAccess>
                            <AdminAuditLogsPage />
                          </RequireAdminAccess>
                        </RequireAuth>
                      </AdminAppOnly>
                    }
                  />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
