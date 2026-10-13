import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PhoneVerificationModal } from '../PhoneVerificationModal';
import * as authApi from '../../api/auth';
import { UserProfile } from '../../store/authStore';

jest.mock('../../api/auth', () => ({
  requestOtpPreCheck: jest.fn(),
  verifyPhoneWithToken: jest.fn(),
  sendWhatsAppOtp: jest.fn(),
  verifyWhatsAppOtp: jest.fn(),
}));

const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;

const PHONE = '9876543210';

const baseUser: UserProfile = {
  id: 1,
  email: 'parent@example.com',
  first_name: 'Pet',
  last_name: 'Parent',
  phone: '+919876543210',
  role: 'customer',
  is_email_verified: true,
  is_phone_verified: true,
  is_active: true,
};

function renderModal(props: Partial<React.ComponentProps<typeof PhoneVerificationModal>> = {}) {
  const onClose = props.onClose ?? jest.fn();
  const onSuccess = props.onSuccess ?? jest.fn();
  const utils = render(
    <PhoneVerificationModal
      visible={props.visible ?? true}
      phone={props.phone ?? PHONE}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
  return { ...utils, onClose, onSuccess };
}

describe('PhoneVerificationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to step 1 with WhatsApp as the primary channel', () => {
    renderModal();
    expect(screen.getByText('Send Code via WhatsApp')).toBeTruthy();
    expect(screen.getByText("Can't receive WhatsApp? Send via SMS instead")).toBeTruthy();
  });

  it('sends a WhatsApp OTP and advances to the code-entry step', async () => {
    mockedAuthApi.sendWhatsAppOtp.mockResolvedValue({ sent: true, expires_in: 300 });
    renderModal();

    fireEvent.press(screen.getByText('Send Code via WhatsApp'));

    await waitFor(() => {
      expect(mockedAuthApi.sendWhatsAppOtp).toHaveBeenCalledWith('+919876543210');
    });
    expect(await screen.findByText('ENTER 6-DIGIT OTP CODE')).toBeTruthy();
  });

  it('verifies the WhatsApp OTP and reports success', async () => {
    mockedAuthApi.sendWhatsAppOtp.mockResolvedValue({ sent: true, expires_in: 300 });
    mockedAuthApi.verifyWhatsAppOtp.mockResolvedValue(baseUser);

    const { onSuccess, onClose } = renderModal();

    fireEvent.press(screen.getByText('Send Code via WhatsApp'));
    await screen.findByText('ENTER 6-DIGIT OTP CODE');

    fireEvent.changeText(screen.getByPlaceholderText('123456'), '482913');
    fireEvent.press(screen.getByText('Verify Code'));

    await waitFor(() => {
      expect(mockedAuthApi.verifyWhatsAppOtp).toHaveBeenCalledWith('+919876543210', '482913');
    });
    expect(onSuccess).toHaveBeenCalledWith(baseUser);
    expect(onClose).toHaveBeenCalled();
  });

  it('resumes the code-entry step if closed and reopened before the code expires', async () => {
    mockedAuthApi.sendWhatsAppOtp.mockResolvedValue({ sent: true, expires_in: 300 });

    const { rerender } = render(
      <PhoneVerificationModal visible phone={PHONE} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.press(screen.getByText('Send Code via WhatsApp'));
    await screen.findByText('ENTER 6-DIGIT OTP CODE');

    // Accidentally close the modal (e.g. backdrop tap, system back gesture)...
    rerender(<PhoneVerificationModal visible={false} phone={PHONE} onClose={jest.fn()} onSuccess={jest.fn()} />);
    // ...then reopen it shortly after.
    rerender(<PhoneVerificationModal visible phone={PHONE} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.getByText('ENTER 6-DIGIT OTP CODE')).toBeTruthy();
    expect(mockedAuthApi.sendWhatsAppOtp).toHaveBeenCalledTimes(1);
  });

  it('resets to step 1 if reopened after the code has expired', async () => {
    mockedAuthApi.sendWhatsAppOtp.mockResolvedValue({ sent: true, expires_in: 300 });
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const { rerender } = render(
      <PhoneVerificationModal visible phone={PHONE} onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.press(screen.getByText('Send Code via WhatsApp'));
    await screen.findByText('ENTER 6-DIGIT OTP CODE');

    rerender(<PhoneVerificationModal visible={false} phone={PHONE} onClose={jest.fn()} onSuccess={jest.fn()} />);

    // Jump forward past the 300s (5 min) expiry window the mocked response granted.
    nowSpy.mockReturnValue(1_000_000 + 301_000);

    rerender(<PhoneVerificationModal visible phone={PHONE} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.getByText('Send Code via WhatsApp')).toBeTruthy();
    nowSpy.mockRestore();
  });

  it('resets to step 1 if reopened for a different phone number', async () => {
    mockedAuthApi.sendWhatsAppOtp.mockResolvedValue({ sent: true, expires_in: 300 });

    const { rerender } = render(
      <PhoneVerificationModal visible phone="9876543210" onClose={jest.fn()} onSuccess={jest.fn()} />
    );

    fireEvent.press(screen.getByText('Send Code via WhatsApp'));
    await screen.findByText('ENTER 6-DIGIT OTP CODE');

    rerender(<PhoneVerificationModal visible={false} phone="9876543210" onClose={jest.fn()} onSuccess={jest.fn()} />);
    rerender(<PhoneVerificationModal visible phone="8825812858" onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.getByText('Send Code via WhatsApp')).toBeTruthy();
  });

  it('falls back to SMS when the user taps the WhatsApp-unavailable link', async () => {
    const fetchMock = jest.fn(async () => ({
      json: async () => ({ sessionInfo: 'session-abc' }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    mockedAuthApi.requestOtpPreCheck.mockResolvedValue({ allowed: true, attempts_remaining: 3 });

    renderModal();

    fireEvent.press(screen.getByText("Can't receive WhatsApp? Send via SMS instead"));

    await waitFor(() => {
      expect(mockedAuthApi.requestOtpPreCheck).toHaveBeenCalledWith('+919876543210');
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('sendVerificationCode'),
      expect.any(Object)
    );
    expect(await screen.findByText('SMS Authentication')).toBeTruthy();
    expect(mockedAuthApi.sendWhatsAppOtp).not.toHaveBeenCalled();
  });
});
