import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutProvider } from './context/LayoutContext';
import Layout from './components/layout/Layout';
import DMShowcase from './components/DMShowcase';
import DMViewer from './components/DMViewer';
import FloorGuide from './components/FloorGuide';
import CustomerFeedbackViewer from './components/feedback/CustomerFeedbackViewer';
import Food from './components/Food';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <LayoutProvider>
        <div className="app">
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
        </div>
      </LayoutProvider>
    </BrowserRouter>
  );
}
