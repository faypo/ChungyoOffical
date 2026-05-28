import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutProvider } from './context/LayoutContext';
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
import ServiceManager from './components/admin/ServiceManager';
import PrivacyPolicy from './components/PrivacyPolicy';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <LayoutProvider>
        <div className="app">
          <Routes>
            {/* Admin — 無 header/footer */}
            <Route path="/admin" element={<AdminLayout />}>
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
              <Route path="service"        element={<ServiceManager />} />
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
                </Routes>
              </Layout>
            } />
          </Routes>
        </div>
      </LayoutProvider>
    </BrowserRouter>
  );
}
