import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VehiclePlaceholder } from '@/components/ui/VehicleCard';

describe('VehiclePlaceholder', () => {
  it('should render the brand and model name', () => {
    // For a brand without logo (e.g. "Dacia" is not in BRAND_LOGOS)
    render(<VehiclePlaceholder brand="Dacia" model="Sandero" />);
    
    expect(screen.getByText(/Dacia/i)).toBeInTheDocument();
    expect(screen.getByText(/Sandero/i)).toBeInTheDocument();
    // Deterministic gradient initial for Dacia should be 'D'
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('should display the logo if available', () => {
    // Renault has a logo in BRAND_LOGOS
    render(<VehiclePlaceholder brand="Renault" model="Clio" />);
    const img = screen.getByAltText('Renault');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('Renault_2021_Text.svg'));
  });
});
