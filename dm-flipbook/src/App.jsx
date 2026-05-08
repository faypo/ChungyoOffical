import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutProvider } from './context/LayoutContext';
import Layout from './components/layout/Layout';
import DMShowcase from './components/DMShowcase';
import DMViewer from './components/DMViewer';
import FloorGuide from './components/FloorGuide';
import CustomerFeedbackViewer from './components/feedback/CustomerFeedbackViewer';
import Food from './components/Food';
import AdminLayout from './components/admin/AdminLayout';
import DMManager from './components/admin/DMManager';
import FloorGuideManager from './components/admin/FloorGuideManager';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <LayoutProvider>
        <div className="app">
          <Routes>
            {/* Admin — 無 header/footer */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dm" replace />} />
              <Route path="dm"    element={<DMManager />} />
              <Route path="floor" element={<FloorGuideManager />} />
            </Route>

            {/* 一般頁面 — 有 Layout */}
            <Route path="*" element={
              <Layout>
                <Routes>
                  <Route path="/"      element={<Navigate to="/dm" replace />} />
                  <Route path="/dm"    element={<DMShowcase />} />
                  <Route path="/dm/:id" element={<DMViewer />} />
                  <Route path="/floor" element={<FloorGuide />} />
                  <Route path="/CustomerFeedback" element={<CustomerFeedbackViewer />} />
                  <Route path="/food" element={<Food />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </div>
      </LayoutProvider>
    </BrowserRouter>
  );
}
