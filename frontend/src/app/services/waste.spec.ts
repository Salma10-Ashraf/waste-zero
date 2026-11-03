import { TestBed } from '@angular/core/testing';
import { Waste } from './waste';

describe('Waste', () => {
  let service: Waste;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Waste);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
