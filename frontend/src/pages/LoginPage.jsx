import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const OTP_LENGTH = 6;

const LoginPage = () => {
    const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
    const [otpDestination, setOtpDestination] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const { login, verifyOtp, resendOtp } = useAuth();
    const navigate = useNavigate();
    const otpRefs = useRef([]);

    // ── Step 1: credentials ──────────────────────────────────────────────────
    const handleCredentialsSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await login(username, password);
            if (result?.otp_required) {
                setOtpDestination(result.destination || '');
                setStep('otp');
                // Focus first OTP box after transition
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: OTP ──────────────────────────────────────────────────────────
    const handleOtpChange = (index, value) => {
        // Handle paste of full OTP
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
            const newDigits = [...otpDigits];
            digits.forEach((d, i) => { if (index + i < OTP_LENGTH) newDigits[index + i] = d; });
            setOtpDigits(newDigits);
            const nextFocus = Math.min(index + digits.length, OTP_LENGTH - 1);
            otpRefs.current[nextFocus]?.focus();
            return;
        }

        const digit = value.replace(/\D/g, '');
        const newDigits = [...otpDigits];
        newDigits[index] = digit;
        setOtpDigits(newDigits);

        if (digit && index < OTP_LENGTH - 1) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifySubmit = async (e) => {
        e.preventDefault();
        const otp = otpDigits.join('');
        if (otp.length < OTP_LENGTH) {
            setError('Please enter all 6 digits.');
            return;
        }
        setError('');
        setLoading(true);

        try {
            await verifyOtp(otp);
            navigate('/');
        } catch (err) {
            setError(err.message);
            // Clear OTP boxes on wrong code
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            setTimeout(() => otpRefs.current[0]?.focus(), 50);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = useCallback(async () => {
        if (resendCooldown > 0) return;
        setError('');
        try {
            await resendOtp();
            // Reset OTP boxes
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            otpRefs.current[0]?.focus();
            // Start 30s cooldown
            setResendCooldown(30);
            const interval = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) { clearInterval(interval); return 0; }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            setError(err.message);
        }
    }, [resendCooldown, resendOtp]);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <rect width="40" height="40" rx="8" fill="#0079BF" />
                        <rect x="8" y="8" width="24" height="24" rx="2" fill="white" />
                        <rect x="12" y="12" width="16" height="3" rx="1" fill="#0079BF" />
                        <rect x="12" y="18" width="16" height="3" rx="1" fill="#0079BF" />
                        <rect x="12" y="24" width="16" height="3" rx="1" fill="#0079BF" />
                    </svg>
                    <h1>Trello Clone</h1>
                </div>

                <div className="auth-card">
                    {/* ── STEP 1: credentials ─────────────────────────────── */}
                    {step === 'credentials' && (
                        <>
                            <h2>Log in to continue</h2>

                            {error && <div className="auth-error">{error}</div>}

                            <form onSubmit={handleCredentialsSubmit}>
                                <div className="form-group">
                                    <label htmlFor="username">Username</label>
                                    <input
                                        id="username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="password">Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="auth-button"
                                    disabled={loading}
                                >
                                    {loading ? 'Sending code...' : 'Continue'}
                                </button>
                            </form>

                            <div className="auth-footer">
                                <Link to="/register">Don't have an account? Sign up</Link>
                            </div>
                        </>
                    )}

                    {/* ── STEP 2: OTP ─────────────────────────────────────── */}
                    {step === 'otp' && (
                        <>
                            <div className="otp-header">
                                <div className="otp-icon">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0079BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                </div>
                                <h2 style={{ marginBottom: 8 }}>Check your email</h2>
                                <p className="otp-subtitle">
                                    A 6-digit verification code was sent to<br />
                                    <strong>{otpDestination}</strong>
                                </p>
                            </div>

                            {error && <div className="auth-error">{error}</div>}

                            <form onSubmit={handleVerifySubmit}>
                                <div className="otp-inputs">
                                    {otpDigits.map((digit, i) => (
                                        <input
                                            key={i}
                                            id={`otp-box-${i}`}
                                            ref={el => otpRefs.current[i] = el}
                                            className="otp-box"
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={digit}
                                            placeholder="·"
                                            onChange={e => handleOtpChange(i, e.target.value)}
                                            onKeyDown={e => handleOtpKeyDown(i, e)}
                                            autoComplete="one-time-code"
                                        />
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    className="auth-button"
                                    disabled={loading || otpDigits.join('').length < OTP_LENGTH}
                                >
                                    {loading ? 'Verifying...' : 'Verify & Log in'}
                                </button>
                            </form>

                            <div className="otp-footer">
                                <button
                                    className="resend-btn"
                                    onClick={handleResend}
                                    disabled={resendCooldown > 0}
                                    type="button"
                                >
                                    {resendCooldown > 0
                                        ? `Resend code in ${resendCooldown}s`
                                        : 'Resend code'}
                                </button>
                                <button
                                    className="back-btn"
                                    type="button"
                                    onClick={() => {
                                        setStep('credentials');
                                        setOtpDigits(Array(OTP_LENGTH).fill(''));
                                        setError('');
                                    }}
                                >
                                    ← Back to login
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;

