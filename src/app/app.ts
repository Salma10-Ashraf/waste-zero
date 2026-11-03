import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
 templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit {
  activeTab: string = 'dashboard';

  menuItems = [
    { id: 1, name: 'ساندوتش شاورما دجاج عائلي', price: 65, category: 'شاورما', cost: 35 },
    { id: 2, name: 'صاج شاورما لحم وسط', price: 85, category: 'شاورما', cost: 45 },
    { id: 3, name: 'وجبة شاورما عربي دجاج', price: 120, category: 'وجبات', cost: 60 },
    { id: 4, name: 'وجبة فتة شاورما لحم', price: 140, category: 'وجبات', cost: 75 },
    { id: 5, name: 'بطاطس مقلية بالجبنة', price: 45, category: 'مقبلات', cost: 18 },
    { id: 6, name: 'مشروب غازي', price: 15, category: 'مشروبات', cost: 7 }
  ];

  cart: { item: any, quantity: number }[] = [];
  orders: any[] = [];
  wasteLogs: any[] = [
    { itemName: 'شاورما دجاج', quantity: 3, reason: 'زيادة تحضير', cost: 105, date: '2026-06-01' },
    { itemName: 'بطاطس مقلية', quantity: 5, reason: 'انتهاء صلاحية', cost: 90, date: '2026-06-02' }
  ];

  newWaste = {
    itemName: '',
    quantity: 1,
    reason: 'زيادة تحضير',
    cost: 0
  };

  ngOnInit() {
    this.loadFromLocalStorage();
  }

  switchTab(tab: string) {
    this.activeTab = tab;
  }

  addToCart(item: any) {
    const existing = this.cart.find(c => c.item.id === item.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ item, quantity: 1 });
    }
  }

  getCartTotal() {
    return this.cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
  }

  checkout() {
    if (this.cart.length === 0) return;
    const newOrder = {
      id: Date.now(),
      items: [...this.cart],
      total: this.getCartTotal(),
      date: new Date().toLocaleDateString('ar-EG')
    };
    this.orders.push(newOrder);
    this.cart = [];
    this.saveToLocalStorage();
    alert('تم تسجيل الطلب بنجاح!');
  }

  addWasteRecord() {
    if (!this.newWaste.itemName) return;
    const selectedItem = this.menuItems.find(i => i.name === this.newWaste.itemName);
    const itemCost = selectedItem ? selectedItem.cost * this.newWaste.quantity : 50;

    this.wasteLogs.push({
      itemName: this.newWaste.itemName,
      quantity: this.newWaste.quantity,
      reason: this.newWaste.reason,
      cost: itemCost,
      date: new Date().toISOString().split('T')[0]
    });

    this.saveToLocalStorage();
    this.newWaste = { itemName: '', quantity: 1, reason: 'زيادة تحضير', cost: 0 };
    alert('تم تسجيل الهدر بنجاح.');
  }

  getTotalSales() {
    return this.orders.reduce((sum, o) => sum + o.total, 0);
  }

  getTotalWasteCost() {
    return this.wasteLogs.reduce((sum, w) => sum + w.cost, 0);
  }

  saveToLocalStorage() {
    localStorage.setItem('waste_zero_orders', JSON.stringify(this.orders));
    localStorage.setItem('waste_zero_waste', JSON.stringify(this.wasteLogs));
  }

  loadFromLocalStorage() {
    const savedOrders = localStorage.getItem('waste_zero_orders');
    const savedWaste = localStorage.getItem('waste_zero_waste');
    if (savedOrders) this.orders = JSON.parse(savedOrders);
    if (savedWaste) this.wasteLogs = JSON.parse(savedWaste);
  }
}