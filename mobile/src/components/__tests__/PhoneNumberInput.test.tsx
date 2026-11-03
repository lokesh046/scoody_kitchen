import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PhoneNumberInput } from '../PhoneNumberInput';

const renderInput = (onChange: (v: string) => void) =>
  render(
    <PhoneNumberInput
      country="IN"
      onCountryChange={() => {}}
      nationalNumber=""
      onNationalNumberChange={onChange}
      placeholder="0000000000"
    />,
  );

describe('PhoneNumberInput', () => {
  it('shows the 0000000000 placeholder, not a realistic example number', () => {
    renderInput(() => {});
    expect(screen.getByPlaceholderText('0000000000')).toBeTruthy();
    expect(screen.queryByPlaceholderText('9876543210')).toBeNull();
  });

  it('cuts a pasted block of numbers to 15 digits', () => {
    const onChange = jest.fn();
    renderInput(onChange as unknown as (v: string) => void);
    fireEvent.changeText(
      screen.getByPlaceholderText('0000000000'),
      '5395 1231 6320 2611 0310 5518 3022 0261',
    );
    expect(onChange).toHaveBeenCalledWith('539512316320261');
    expect(onChange.mock.calls[0][0]).toHaveLength(15);
  });

  it('still strips letters and symbols, and keeps normal numbers whole', () => {
    const onChange = jest.fn();
    renderInput(onChange as unknown as (v: string) => void);
    fireEvent.changeText(screen.getByPlaceholderText('0000000000'), '+91-98765 43210');
    expect(onChange).toHaveBeenCalledWith('919876543210');
  });
});
