import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuManagement } from './menu-management';

describe('MenuManagement', () => {
  let component: MenuManagement;
  let fixture: ComponentFixture<MenuManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
