import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutProvider } from './context/LayoutContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import AdminGuard from './components/admin/AdminGuard';
import LoginPage from './components/admin/LoginPage';
import ChangePasswordPage from './components/admin/ChangePasswordPage';
import Layout from './components/layout/Layout';
import DMShowcase from './components/DMShowcase';
import DMViewer from './components/DMViewer';
import FloorGuide from './components/FloorGuide';
import CustomerFeedbackViewer from './components/feedback/CustomerFeedbackViewer';
import Food from './components/Food';
import Service from './components/Service';
import AdminLayout from './components/admin/AdminLayout';
import Winners from './components/Winners';
import ActivityPage from './components/ActivityPage';
import GalleryPage from './components/GalleryPage';
import Home from './components/Home';
import FaqPage from './pages/FaqPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import Leasing from './components/Leasing';
import './App.css';

// 後台管理頁面只有登入後台的人會用到，改成路由層級動態載入（code splitting），
// 避免一般訪客看 DM/活動/藝廊等前台頁面時，要連整包後台管理介面的 JS 都下載。
const UsersManager         = lazy(() => import('./components/admin/UsersManager'));
const RolesManager         = lazy(() => import('./components/admin/RolesManager'));
const DMManager            = lazy(() => import('./components/admin/DMManager'));
const FloorGuideManager    = lazy(() => import('./components/admin/FloorGuideManager'));
const FoodGuideManager     = lazy(() => import('./components/admin/FoodGuideManager'));
const WinnersManager       = lazy(() => import('./components/admin/WinnersManager'));
const ActivityManager      = lazy(() => import('./components/admin/ActivityManager'));
const GalleryManager       = lazy(() => import('./components/admin/GalleryManager'));
const BannerManager        = lazy(() => import('./components/admin/BannerManager'));
const HomeEventsManager    = lazy(() => import('./components/admin/HomeEventsManager'));
const HomeFBManager        = lazy(() => import('./components/admin/HomeFBManager'));
const HomePromoManager     = lazy(() => import('./components/admin/HomePromoManager'));
const LogoManager          = lazy(() => import('./components/admin/LogoManager'));
const SustainabilityManager = lazy(() => import('./components/admin/SustainabilityManager'));
const StatsManager         = lazy(() => import('./components/admin/StatsManager'));
const ServiceManager       = lazy(() => import('./components/admin/ServiceManager'));
const FaqManager           = lazy(() => import('./components/admin/FaqManager'));
const AwsUsageManager      = lazy(() => import('./components/admin/AwsUsageManager'));

function RouteLoading() {
  return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>載入中…</div>;
}

function SuperAdminOnly({ children }) {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? children : <Navigate to="/admin/banner" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <LayoutProvider>
        <div className="app">
          <Routes>
            {/* FAQ 獨立頁（供 webview 嵌入） */}
            <Route path="/faq" element={<FaqPage />} />

            {/* Admin 登入頁 */}
            <Route path="/admin/login" element={<LoginPage />} />

            {/* Admin 強制改密碼（需登入，但不走 AdminLayout） */}
            <Route path="/admin/change-password" element={<AdminGuard><ChangePasswordPage /></AdminGuard>} />

            {/* Admin — 無 header/footer，需登入 */}
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route index element={<Navigate to="banner" replace />} />
              <Route path="banner"      element={<Suspense fallback={<RouteLoading />}><BannerManager /></Suspense>} />
              <Route path="home-event"  element={<Suspense fallback={<RouteLoading />}><HomeEventsManager /></Suspense>} />
              <Route path="home-fb"     element={<Suspense fallback={<RouteLoading />}><HomeFBManager /></Suspense>} />
              <Route path="home-promo"  element={<Suspense fallback={<RouteLoading />}><HomePromoManager /></Suspense>} />
              <Route path="logos"       element={<Suspense fallback={<RouteLoading />}><LogoManager /></Suspense>} />
              <Route path="dm"       element={<Suspense fallback={<RouteLoading />}><DMManager /></Suspense>} />
              <Route path="floor"    element={<Suspense fallback={<RouteLoading />}><FloorGuideManager /></Suspense>} />
              <Route path="food"     element={<Suspense fallback={<RouteLoading />}><FoodGuideManager /></Suspense>} />
              <Route path="winners"  element={<Suspense fallback={<RouteLoading />}><WinnersManager /></Suspense>} />
              <Route path="activity" element={<Suspense fallback={<RouteLoading />}><ActivityManager /></Suspense>} />
              <Route path="gallery"        element={<Suspense fallback={<RouteLoading />}><GalleryManager /></Suspense>} />
              <Route path="sustainability" element={<Suspense fallback={<RouteLoading />}><SustainabilityManager /></Suspense>} />
              <Route path="stats"         element={<Suspense fallback={<RouteLoading />}><StatsManager /></Suspense>} />
              <Route path="service"        element={<Suspense fallback={<RouteLoading />}><ServiceManager /></Suspense>} />
              <Route path="faq"            element={<Suspense fallback={<RouteLoading />}><FaqManager /></Suspense>} />
              <Route path="aws-usage"      element={<Suspense fallback={<RouteLoading />}><AwsUsageManager /></Suspense>} />
              <Route path="users"          element={<SuperAdminOnly><Suspense fallback={<RouteLoading />}><UsersManager /></Suspense></SuperAdminOnly>} />
              <Route path="roles"          element={<SuperAdminOnly><Suspense fallback={<RouteLoading />}><RolesManager /></Suspense></SuperAdminOnly>} />
            </Route>

            {/* 一般頁面 — 有 Layout */}
            <Route path="*" element={
              <Layout>
                <Routes>
                  <Route path="/"      element={<Home />} />
                  <Route path="/dm"    element={<DMShowcase />} />
                  <Route path="/dm/:id" element={<DMViewer />} />
                  <Route path="/floor" element={<FloorGuide />} />
                  <Route path="/CustomerFeedback" element={<CustomerFeedbackViewer />} />
                  <Route path="/food"    element={<Food />} />
                  <Route path="/service" element={<Service />} />
                  <Route path="/winners"          element={<Winners />} />
                  <Route path="/activity/:id"    element={<ActivityPage />} />
                  <Route path="/gallery"         element={<GalleryPage />} />
                  <Route path="/privacy"         element={<PrivacyPolicy />} />
                  <Route path="/leasing"         element={<Leasing />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </div>
      </LayoutProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
