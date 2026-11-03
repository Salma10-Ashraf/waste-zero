
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { WasteService, MenuItem } from '../../services/waste';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu-management.html',
  styleUrl: './menu-management.scss'
})
export class MenuManagement implements OnInit {
  menuItems: MenuItem[] = [];

  form = {
    name: '',
    category: '',
    price_egp: 0
  };

  editingId: number | null = null;
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  searchQuery = '';

  constructor(private wasteService: WasteService) {}

  ngOnInit(): void {
    this.loadMenu();
  }

  get filteredItems(): MenuItem[] {
    const query = this.searchQuery.trim().toLowerCase();

    if (!query) {
      return this.menuItems;
    }

    return this.menuItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }

  loadMenu(): void {
    this.loading = true;
    this.errorMessage = '';

    this.wasteService.getMenu().subscribe({
      next: items => {
        this.menuItems = items;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage =
          'تعذر تحميل المنيو. تأكدي إن الـ Backend شغال.';
      }
    });
  }

  saveItem(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const name = this.form.name.trim();
    const category = this.form.category.trim();
    const price = Number(this.form.price_egp);

    if (name.length < 2 || category.length < 2 || !Number.isFinite(price) || price <= 0) {
      this.errorMessage =
        'اكتبي اسم الصنف والتصنيف بشكل صحيح، والسعر لازم يكون أكبر من صفر.';
      return;
    }

    const payload = {
      name,
      category,
      price_egp: price
    };

    this.saving = true;

    const request = this.editingId === null
      ? this.wasteService.addMenuItem(payload)
      : this.wasteService.updateMenuItem(this.editingId, payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.successMessage = this.editingId === null
          ? 'تمت إضافة الصنف بنجاح.'
          : 'تم تعديل الصنف بنجاح.';

        this.resetForm();
        this.loadMenu();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage =
          error.error?.detail || 'حصل خطأ أثناء حفظ الصنف.';
      }
    });
  }

  editItem(item: MenuItem): void {
    this.editingId = item.item_id;

    this.form = {
      name: item.name,
      category: item.category,
      price_egp: item.price_egp
    };

    this.errorMessage = '';
    this.successMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteItem(item: MenuItem): void {
    const confirmed = window.confirm(
      `هل أنتِ متأكدة من حذف "${item.name}" من المنيو؟`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    this.wasteService.deleteMenuItem(item.item_id).subscribe({
      next: () => {
        this.successMessage = 'تم حذف الصنف بنجاح.';

        if (this.editingId === item.item_id) {
          this.resetForm();
        }

        this.loadMenu();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage =
          error.error?.detail || 'تعذر حذف الصنف.';
      }
    });
  }

  resetForm(): void {
    this.form = {
      name: '',
      category: '',
      price_egp: 0
    };

    this.editingId = null;
  }
  getCategoriesCount(): number {
  return new Set(
    this.menuItems.map(item => item.category.trim().toLowerCase())
  ).size;
}

getAveragePrice(): number {
  if (this.menuItems.length === 0) {
    return 0;
  }

  const total = this.menuItems.reduce(
    (sum, item) => sum + Number(item.price_egp),
    0
  );

  return total / this.menuItems.length;
}
}
