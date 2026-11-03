import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { MenuManagement } from './components/menu-management/menu-management';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
   {
    path: 'menu-management',
    component: MenuManagement
  }
];