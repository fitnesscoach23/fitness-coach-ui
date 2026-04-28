import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BillingApiService {

  constructor(private http: HttpClient) { }

  getSubscription(memberId: string) {
  return this.http.get<any>(
    `${environment.billingApi}/billing/subscription/${memberId}`
  );
}

  getPaymentHistory(memberId: string) {
    return this.http.get<any[]>(
      `${environment.billingApi}/billing/payment/history/${memberId}`
    );
  }

  startManualPayment(memberId: string, amount: number) {
  return this.http.post(
    `${environment.billingApi}/billing/payment/start/${memberId}?amount=${amount}`,
    {}
  );
}

confirmPayment(paymentId: string, paymentDate?: string | null) {
  return this.http.post(
    `${environment.billingApi}/billing/payment/confirm/${paymentId}`,
    { paymentDate: paymentDate || null },
    { responseType: 'text' }
  );
}

startOnlinePayment(memberId: string, amount: number) {
  return this.http.post<any>(
    `${environment.billingApi}/billing/payment/start/${memberId}?amount=${amount}&mode=ONLINE`,
    {}
  );
}

deletePayment(paymentId: string) {
  return this.http.delete(
    `${environment.billingApi}/billing/payment/${paymentId}`,
    { responseType: 'text' }
  );
}

}
