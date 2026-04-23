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
  const [lastName, setLastName] = useState('林');
  const [gender, setGender] = useState('1'); 
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('0901631882');
  const [content, setContent] = useState('test');
  const [errors, setErrors] = useState({});
  
  const [isLoading, setIsLoading] = useState(false);

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
      const API_URL = import.meta.env.VITE_PROXY_API_URL;
      const queryString = new URLSearchParams({'payload':transportData}).toString();      
      const finalUrl = `${API_URL}?${queryString}`;
      
      const response = await fetch(finalUrl, { method: 'POST'  });
      console.log(response);

      if (response.ok) { 
        // await sendEmail();
        alert('意見單已成功發送！感謝您的寶貴回饋。');
        return true;
      } else {
        const errorText = await response.text(); 
        console.error('伺服器錯誤內容:', errorText);
        alert('發送失敗，請確認網路狀態或稍後再試。');
        return false;
      }
      
    } catch (error) {
      console.error('API 傳送發生錯誤:', error);
      alert('系統發生異常，請聯絡客服人員。');
      return false;
    }
  };

  const sendEmail = async () => {
    // 請替換為您最新的 GAS 網址
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyC_cevHRytf5cB-7_OkxB_COM8_P6zeqsbGsuZ1xJtNWtzwWIL5tvsWt0nPePV8xPzdw/exec";

    try {
      const response = await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors"
      });
      console.log("請求已送出");
    } catch (error) {
      console.error("寄信請求失敗", error);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault(); 

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

    if(!confirm('確定要送出嗎？送出後將無法修改。')) {
      return;
    }

    const titleSuffix = gender === '1' ? '先生' : '小姐';
    const title = `${cleanLastName}${titleSuffix}`;

    const feedbackData = {
      Surname: cleanLastName,
      sex: gender,
      phone: cleanPhone,
      Opinion: cleanContent 
    };
    // Loading
    setIsLoading(true);

    try {
      const isSuccess = await fetchFeedback(feedbackData);
      if (isSuccess) {
        handleReset(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = (confirmState) => {
    if(confirmState){
      if(!confirm('確定要重新填寫嗎？目前輸入的資料將會被清除。')) {
        return;
      }
    }
    setLastName('');
    setGender('1');
    setEmail('');
    setPhone('');
    setContent('');
    setErrors({});
  };

  const handleChange = (setter, fieldName) => (e) => {
    setter(e.target.value);
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  return (
    <>
      {/* 這裡加入 Loading 遮罩組件 */}
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
              <h2 style={{ textAlign: 'center', marginBottom: '40px' }}>顧客意見回饋</h2>
            </div>            
            
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
                          onClick={() => !isLoading && setGender('1')}
                        >男</div>
                        <div 
                          className={`gender-btn ${gender === '2' ? 'active' : ''} ${isLoading ? 'disabled' : ''}`}
                          onClick={() => !isLoading && setGender('2')}
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
              <div className="form-label">
                &nbsp;
              </div>
              <div className="form-control">
                <div className="btn-group">
                  <button 
                    type="button" 
                    className="submit-btn reset-btn" 
                    onClick={() => handleReset()}
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
