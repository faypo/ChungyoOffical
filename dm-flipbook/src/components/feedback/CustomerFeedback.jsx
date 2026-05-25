import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import './CustomerFeedback.css';
import ConfirmModal from './ConfirmModal';

const fieldConfig = {
  lastName: true,
  gender: true,
  email: false,
  phone: true,
  content: true
};

// 錯誤提示icon與訊息
const ErrorMessage = ({ message }) => {
  if (!message) return null;
  return (
    <div className="error-text">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      {message}
    </div>
  );
};

export default function CustomerFeedback() {
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('1'); 
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ message: '', type: '' });

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    actionType: '', // submit or reset
    title: '',
    message: '',
    confirmText: '',
    confirmBtnStyle: 'primary'
  });

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

      const envResponse = await fetch('/env.json');

      if (!envResponse.ok) {
        throw new Error('無法載入env.json');
      }
      
      const envConfig = await envResponse.json();
      const API_URL = envConfig.api_url;

      const transportData = prepareTransportPayload(data);

      const requestData = { 
        payload: transportData 
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(requestData)
      });
      if (response.ok) { 
        return { success: true, message: '意見回饋已成功發送！感謝您的寶貴回饋。' };
      } else {
        return { success: false, message: '系統發生異常，請聯絡客服人員。'  };
      }

    } catch (error) {
      console.log(error);
      return { success: false, message: '系統發生異常，請聯絡客服人員。' };
    }
  };

  const handlePreSubmit = (e) => {
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
      } else if (cleanContent.length > 1000) {
        newErrors.content = '意見內容請勿超過 1000 字！';
      }
    }

    if (!isAgreed) {
      newErrors.isAgreed = '請務必勾選同意提供個人資料！';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); 
      return; 
    }

    setErrors({});

    setModalConfig({
      isOpen: true,
      actionType: 'submit',
      title: '確認送出',
      message: '確定要送出這份意見回饋嗎？送出後將無法修改。',
      confirmText: '確認送出',
      confirmBtnStyle: 'primary'
    });
  };

  const executeSubmit = async () => {
    closeModal();
    const cleanLastName = sanitizeInput(lastName);
    const cleanPhone = sanitizeInput(phone);
    const cleanContent = sanitizeInput(content);

    const now = new Date();
    const currentMinutes = now.getMinutes();
    const remainder = currentMinutes % 10;
    
    if (remainder !== 0) {
      now.setMinutes(currentMinutes + (10 - remainder));
    }

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    const feedbackData = {
      Surname: cleanLastName,
      sex: gender,
      phone: cleanPhone,
      Opinion: cleanContent,
      hh: currentTime
    };
    
    setIsLoading(true);

    try {
      const result = await fetchFeedback(feedbackData);
      setSubmitStatus({ 
        message: result.message, 
        type: result.success ? 'success' : 'error' 
      });

      if (result.success) {
        actualReset(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreReset = () => {
    setModalConfig({
      isOpen: true,
      actionType: 'reset',
      title: '重新填寫',
      message: '確定要清除所有已填寫的資料嗎？',
      confirmText: '確定清除',
      confirmBtnStyle: 'danger'
    });
  };

  const executeReset = () => {
    closeModal();
    actualReset(true);
  };

  const actualReset = (clearStatusMessage = true) => {
    setLastName('');
    setGender('1');
    setEmail('');
    setPhone('');
    setContent('');
    setIsAgreed(false);
    setErrors({});
    if (clearStatusMessage) {
      setSubmitStatus({ message: '', type: '' });
    }
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleModalConfirm = () => {
    if (modalConfig.actionType === 'submit') {
      executeSubmit();
    } else if (modalConfig.actionType === 'reset') {
      executeReset();
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

      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        confirmBtnStyle={modalConfig.confirmBtnStyle}
        onConfirm={handleModalConfirm}
        onCancel={closeModal}
      />

      <div className="feedback-wrapper">
        <div className="feedback-container">
          <form onSubmit={handlePreSubmit} noValidate>
            <div className='form-title'>
              <h2>顧客意見回饋</h2>
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
                      <ErrorMessage message={errors.lastName} />
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
                  <ErrorMessage message={errors.email} />
                </div>
              </div>
            )}

            {fieldConfig.phone && (
              <div className="form-row">
                <div className="form-label">
                  <span className="required-star">*</span>手機號碼
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
                  <ErrorMessage message={errors.phone} />
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
                  <ErrorMessage message={errors.content} />
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-label btn-nbsp">
                &nbsp;
              </div>
              <div className="form-control">
                <div className="privacy-policy-box">
                  <strong className='privacy-policy-label'>顧客意見回饋個資法說明事項：</strong>
                  <p className="privacy-policy-text">
                    中友百貨股份有限公司 為提供完善與多元之會員服務，將依《個人資料保護法》蒐集、處理及利用您所提供之個人資料。您可依法提出查詢、閱覽、更正、停止利用或刪除個人資料等權利；
                    若不同意本公司處理及利用您的個人資料，得立即聯繫本公司停止相關作業，並辦理會員資格註銷。本公司有權保留修訂本隱私權政策之權利，修訂內容將公告於本公司官方網站。
                  </p>
                </div>

                <div className="btn-group isagree-group">
                  <input 
                    type="checkbox"
                    id="agreement-checkbox"
                    checked={isAgreed}
                    disabled={isLoading}
                    className='isagree-checkbox'
                    onChange={(e) => {
                      setIsAgreed(e.target.checked);
                      if (errors.isAgreed) {
                        setErrors(prev => ({ ...prev, isAgreed: '' }));
                      }
                      if (submitStatus.message) {
                        setSubmitStatus({ message: '', type: '' });
                      }
                    }}
                  />
                  <label>
                    <span>本人同意將個人資料(包括但不限於姓氏、性別、手機號碼) 提供予 中友百貨 ，作為「顧客意見回饋」聯繫及回覆之用。</span>
                  </label>
                </div>
                <ErrorMessage message={errors.isAgreed} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-label btn-nbsp">
                &nbsp;
              </div>
              <div className="form-control">
                <div className="btn-group">
                  <button 
                    type="button" 
                    className="submit-btn reset-btn" 
                    onClick={handlePreReset} 
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

