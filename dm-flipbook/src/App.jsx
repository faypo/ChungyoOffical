import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DMShowcase from './components/DMShowcase';
import DMViewer from './components/DMViewer';
import FloorGuide from './components/FloorGuide';
import CustomerFeedbackViewer from './components/feedback/CustomerFeedbackViewer';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/"      element={<Navigate to="/dm" replace />} />
          <Route path="/dm"    element={<DMShowcase />} />
          <Route path="/dm/:id" element={<DMViewer />} />
          <Route path="/floor" element={<FloorGuide />} />
          <Route path="/CustomerFeedback" element={<CustomerFeedbackViewer />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
