import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PhoneVerificationGate } from '../PhoneVerificationGate';
import * as authApi from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../api/auth', () => ({
  verifyPhoneWithToken: jest.fn(),
  sendWhatsAppOtp: jest.fn(),
  verifyWhatsAppOtp: jest.fn(),
}));
jest.mock('../../../App', () => ({ navigationRef: { isReady: () => false, navigate: jest.fn() } }));
jest.mock('../../store/authStore', () => ({ useAuthStore: jest.fn() }));

const mockedAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockedStore = useAuthStore as unknown as jest.Mock;

const userA = { id: 1, email: 'a@example.com', phone: null, is_phone_verified: false, role: 'customer' };
const userB = { id: 2, email: 'b@example.com', phone: null, is_phone_verified: false, role: 'customer' };
const signedIn = (user: any) => mockedStore.mockReturnValue({ user, updateUser: jest.fn(), logout: jest.fn() });

const enterNumberAndSend = async () => {
  fireEvent.changeText(screen.getByPlaceholderText('0000000000'), '9876543210');
  fireEvent.press(screen.getByText('Send Verification Code'));
  await waitFor(() => expect(screen.getByText(/Code sent by SMS/)).toBeTruthy());
};

describe('PhoneVerificationGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthApi.sendWhatsAppOtp.mockResolvedValue({ sent: true, expires_in: 300 } as any);
  });

  it('lets the user go back from the code screen to fix a wrong number', async () => {
    signedIn(userA);
    render(<PhoneVerificationGate />);
    await enterNumberAndSend();

    fireEvent.press(screen.getByText('Wrong number? Change number'));

    expect(screen.getByText('Send Verification Code')).toBeTruthy();
    expect(screen.queryByText(/Code sent by SMS/)).toBeNull();
    // the number is still there, ready to be edited
    expect(screen.getByDisplayValue('9876543210')).toBeTruthy();
  });

  it('starts clean for the next account: no old number, no code screen, nothing sent for them', async () => {
    signedIn(userA);
    const { rerender } = render(<PhoneVerificationGate />);
    await enterNumberAndSend();
    expect(mockedAuthApi.sendWhatsAppOtp).toHaveBeenCalledTimes(1);

    // sign out, then a DIFFERENT account signs in (the gate stays mounted the whole time)
    signedIn(userB);
    rerender(<PhoneVerificationGate />);

    await waitFor(() => expect(screen.getByText('Send Verification Code')).toBeTruthy());
    expect(screen.queryByText(/Code sent by SMS/)).toBeNull();
    expect(screen.queryByDisplayValue('9876543210')).toBeNull();
    expect(mockedAuthApi.sendWhatsAppOtp).toHaveBeenCalledTimes(1); // nothing new was sent
  });
});
