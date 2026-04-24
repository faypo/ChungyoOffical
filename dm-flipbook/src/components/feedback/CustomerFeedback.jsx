import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import './CustomerFeedback.css';

const fieldConfig = {
  lastName: true,
  gender: true,
  email: false,
  phone: true,
  content: true
};

export default function CustomerFeedback() {
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('1'); 
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ message: '', type: '' });

  const appProfile = {
    c1: '6368756e', c2: '67796f2d', c3: '32383431', c4: '31303236', //app_K
    m1: '32383431', m2: '31303236', m3: '2d636875', m4: '6e67796f'  //app_V
  };

  const allocateBuffer = (p1, p2, p3, p4) => {
    return CryptoJS.enc.Hex.parse([p1, p2, p3, p4].join(''));
  };


  const primaryCtx = allocateBuffer(appProfile.c1, appProfile.c2, appProfile.c3, appProfile.c4);
  const offsetCtx = allocateBuffer(appProfile.m1, appProfile.m2, appProfile.m3, appProfile.m4);

  const sanitizeInput = (str) => {
    if (!str) return '';
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#x27;')     
      .replace(/"/g, '&quot;')       
      .replace(/;/g, '&#59;')       
      .replace(/--/g, '&#45;&#45;')  
      .trim();
  };

  const prepareTransportPayload = (data) => {
    const rawStream = JSON.stringify(data);
    const processed = CryptoJS.AES.encrypt(rawStream, primaryCtx, {
      iv: offsetCtx,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return processed.toString(); 
  };

    const fetchFeedback = async (data) => {
    try {
      
      const transportData = prepareTransportPayload(data);
      const API_URL = '/api/feedback'

      const requestData = {
        payload: transportData
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          // 告訴後端我們傳送的是 JSON 格式
          'Content-Type': 'application/json'
        },
        // 將物件轉換為 JSON 字串放入 body
        body: JSON.stringify(requestData)
      });
      if (response.ok) { 
        return { success: true, message: '意見單已成功發送！感謝您的寶貴回饋。' };
      } else {
        const errorText = await response.text(); 
        return { success: false, message: '發送失敗，請確認網路狀態或稍後再試。' };
      }
      
    } catch (error) {
      console.log(error);
      return { success: false, message: '系統發生異常，請聯絡客服人員。' };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setSubmitStatus({ message: '', type: '' });

    const cleanLastName = sanitizeInput(lastName);
    const cleanEmail = sanitizeInput(email);
    const cleanPhone = sanitizeInput(phone);
    const cleanContent = sanitizeInput(content);

    const newErrors = {};

    if (fieldConfig.lastName) {
      const chineseRegex = /^[\u4e00-\u9fa5]+$/;
      if (!cleanLastName) {
        newErrors.lastName = '姓氏不得為空！';
      } else if (!chineseRegex.test(cleanLastName)) {
        newErrors.lastName = '姓氏僅限輸入中文字！';
      } else if (cleanLastName.length > 2) {
        newErrors.lastName = '姓氏請勿超過兩個字！';
      }
    }

    if (fieldConfig.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail) {
        newErrors.email = 'Email 不得為空！';
      } else if (!emailRegex.test(cleanEmail)) {
        newErrors.email = '請輸入正確的 Email 格式！';
      }
    }

    if (fieldConfig.phone) {
      const phoneRegex = /^0\d{9}$/;
      if (!cleanPhone) {
        newErrors.phone = '聯絡電話不得為空！';
      } else if (!phoneRegex.test(cleanPhone)) {
        newErrors.phone = '電話必須為 10 碼數字！ 範例: 0901234567';
      }
    }

    if (fieldConfig.content) {
      if (!cleanContent) {
        newErrors.content = '意見內容不得為空！';
      }else if (cleanContent.length > 1000) {
        newErrors.content = '意見內容請勿超過 1000 字！';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); 
      return; 
    }

    setErrors({});



    const titleSuffix = gender === '1' ? '先生' : '小姐';
    const title = `${cleanLastName}${titleSuffix}`;

    const feedbackData = {
      Surname: cleanLastName,
      sex: gender,
      phone: cleanPhone,
      Opinion: cleanContent 
    };
    
    setIsLoading(true);

    try {
      const result = await fetchFeedback(feedbackData);
      setSubmitStatus({ 
        message: result.message, 
        type: result.success ? 'success' : 'error' 
      });

      if (result.success) {
        handleReset(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = (clearStatusMessage = true) => {
    setLastName('');
    setGender('1');
    setEmail('');
    setPhone('');
    setContent('');
    setErrors({});
    if (clearStatusMessage) {
      setSubmitStatus({ message: '', type: '' });
    }
  };

  const handleChange = (setter, fieldName) => (e) => {
    setter(e.target.value);
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
    if (submitStatus.message) {
      setSubmitStatus({ message: '', type: '' });
    }
  };

  return (
    <>
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p className="loading-text">資料傳送中，請稍候...</p>
        </div>
      )}

      <div className="feedback-wrapper">
        <div className="feedback-container">
          <form onSubmit={handleSubmit} noValidate>
            <div>
              <h2 style={{ textAlign: 'center', marginBottom: '15px' }}>顧客意見回饋</h2>
            </div>        
            {submitStatus.message && (
              <div className={`status-message ${submitStatus.type}`}>
                {submitStatus.message}
              </div>
            )}
            
            { (fieldConfig.lastName || fieldConfig.gender) && (
              <div className="split-row">
                {fieldConfig.lastName && (
                  <div className="split-half">
                    <div className="form-label">
                      <span className="required-star">*</span>姓氏
                    </div>
                    <div className="form-control">
                      <input 
                        type="text" 
                        className={`input-box ${errors.lastName ? 'has-error' : ''}`}
                        value={lastName} 
                        onChange={handleChange(setLastName, 'lastName')} 
                        placeholder="請輸入中文姓氏"
                        disabled={isLoading} 
                      />
                      {errors.lastName && <div className="error-text">{errors.lastName}</div>}
                    </div>
                  </div>
                )}

                {fieldConfig.gender && (
                  <div className="split-half">
                    <div className="form-label">
                      <span className="required-star">*</span>性別
                    </div>
                    <div className="form-control">
                      <div className="gender-group">
                        <div
                          className={`gender-btn ${gender === '1' ? 'active' : ''} ${isLoading ? 'disabled' : ''}`}
                          onClick={() => {
                            if(!isLoading) {
                              setGender('1');
                              setSubmitStatus({ message: '', type: '' });
                            }
                          }}
                        >男</div>
                        <div 
                          className={`gender-btn ${gender === '2' ? 'active' : ''} ${isLoading ? 'disabled' : ''}`}
                          onClick={() => {
                            if(!isLoading) {
                              setGender('2');
                              setSubmitStatus({ message: '', type: '' });
                            }
                          }}
                        >女</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {fieldConfig.email && (
              <div className="form-row">
                <div className="form-label">
                  <span className="required-star">*</span>E-mail
                </div>
                <div className="form-control">
                  <input 
                    type="email" 
                    className={`input-box ${errors.email ? 'has-error' : ''}`}
                    value={email} 
                    onChange={handleChange(setEmail, 'email')}
                    placeholder="" 
                    disabled={isLoading}
                  />
                  {errors.email && <div className="error-text">{errors.email}</div>}
                </div>
              </div>
            )}

            {fieldConfig.phone && (
              <div className="form-row">
                <div className="form-label">
                  <span className="required-star">*</span>聯絡電話
                </div>
                <div className="form-control">
                  <input 
                    type="tel" 
                    className={`input-box ${errors.phone ? 'has-error' : ''}`}
                    value={phone} 
                    onChange={handleChange(setPhone, 'phone')} 
                    placeholder=""
                    disabled={isLoading}
                  />
                  {errors.phone && <div className="error-text">{errors.phone}</div>}
                </div>
              </div>
            )}

            {fieldConfig.content && (
              <div className="form-row">
                <div className="form-label">
                  <span className="required-star">*</span>意見內容
                </div>
                <div className="form-control">
                  <div className="textarea-wrapper">
                    <textarea 
                      className={`input-box ${errors.content ? 'has-error' : ''}`}
                      value={content} 
                      onChange={handleChange(setContent, 'content')} 
                      maxLength={1000}
                      placeholder="請輸入您的寶貴意見..."
                      disabled={isLoading}
                    />
                    {/* 顯示字數的區塊 */}
                    <div className={`char-counter ${content.length >= 1000 ? 'limit-reached' : ''}`}>
                      {content.length} / 1000
                    </div>
                  </div>
                  {errors.content && <div className="error-text">{errors.content}</div>}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-label btn-nbsp">
                &nbsp;
              </div>
              <div className="form-control">
                <div className="btn-group">
                  <button 
                    type="button" 
                    className="submit-btn reset-btn" 
                    onClick={() => handleReset(true)}
                    disabled={isLoading}
                  >
                    重新填寫
                  </button>
                  <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={isLoading}
                  >
                    {isLoading ? '處理中...' : '確認送出'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

