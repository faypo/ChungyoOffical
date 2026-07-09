import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutProvider } from './context/LayoutContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import AdminGuard from './components/admin/AdminGuard';
import LoginPage from './components/admin/LoginPage';
import ChangePasswordPage from './components/admin/ChangePasswordPage';
import UsersManager from './components/admin/UsersManager';
import RolesManager from './components/admin/RolesManager';
import Layout from './components/layout/Layout';
import DMShowcase from './components/DMShowcase';
import DMViewer from './components/DMViewer';
import FloorGuide from './components/FloorGuide';
import CustomerFeedbackViewer from './components/feedback/CustomerFeedbackViewer';
import Food from './components/Food';
import Service from './components/Service';
import AdminLayout from './components/admin/AdminLayout';
import DMManager from './components/admin/DMManager';
import FloorGuideManager from './components/admin/FloorGuideManager';
import FoodGuideManager from './components/admin/FoodGuideManager';
import WinnersManager from './components/admin/WinnersManager';
import ActivityManager from './components/admin/ActivityManager';
import GalleryManager from './components/admin/GalleryManager';
import Winners from './components/Winners';
import ActivityPage from './components/ActivityPage';
import GalleryPage from './components/GalleryPage';
import Home from './components/Home';
import BannerManager from './components/admin/BannerManager';
import HomeEventsManager from './components/admin/HomeEventsManager';
import HomeFBManager from './components/admin/HomeFBManager';
import HomePromoManager from './components/admin/HomePromoManager';
import LogoManager from './components/admin/LogoManager';
import SustainabilityManager from './components/admin/SustainabilityManager';
import StatsManager from './components/admin/StatsManager';
import ServiceManager from './components/admin/ServiceManager';
import FaqManager from './components/admin/FaqManager';
import FaqPage from './pages/FaqPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import Leasing from './components/Leasing';
import './App.css';

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
              <Route path="banner"      element={<BannerManager />} />
              <Route path="home-event"  element={<HomeEventsManager />} />
              <Route path="home-fb"     element={<HomeFBManager />} />
              <Route path="home-promo"  element={<HomePromoManager />} />
              <Route path="logos"       element={<LogoManager />} />
              <Route path="dm"       element={<DMManager />} />
              <Route path="floor"    element={<FloorGuideManager />} />
              <Route path="food"     element={<FoodGuideManager />} />
              <Route path="winners"  element={<WinnersManager />} />
              <Route path="activity" element={<ActivityManager />} />
              <Route path="gallery"        element={<GalleryManager />} />
              <Route path="sustainability" element={<SustainabilityManager />} />
              <Route path="stats"         element={<StatsManager />} />
              <Route path="service"        element={<ServiceManager />} />
              <Route path="faq"            element={<FaqManager />} />
              <Route path="users"          element={<SuperAdminOnly><UsersManager /></SuperAdminOnly>} />
              <Route path="roles"          element={<SuperAdminOnly><RolesManager /></SuperAdminOnly>} />
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
