import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  NotificationApiService,
  NotificationChannel,
  NotificationListItem,
  NotificationStatus,
  NotificationType,
  SendNotificationPayload
} from '../../../../core/api/notification-api.service';
import { MemberApiService } from '../../../../core/api/member-api.service';

@Component({
  selector: 'app-notification-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-home.component.html',
  styleUrls: ['./notification-home.component.scss']
})
export class NotificationHomeComponent implements OnInit {
  members: any[] = [];
  membersLoading = true;

  sending = false;
  loadingHistory = false;
  loadingDetails = false;
  error: string | null = null;
  sendMessage: string | null = null;

  channelOptions: NotificationChannel[] = ['EMAIL', 'SMS'];
  typeOptions: NotificationType[] = ['WELCOME', 'PAYMENT_REMINDER', 'GENERIC'];
  statusOptions: NotificationStatus[] = ['PENDING', 'SENT', 'FAILED'];

  composeForm: {
    memberId: string;
    channel: NotificationChannel;
    type: NotificationType;
    recipient: string;
    subject: string;
    message: string;
  } = {
    memberId: '',
    channel: 'EMAIL',
    type: 'WELCOME',
    recipient: '',
    subject: 'Welcome to your program',
    message: 'Welcome to the program'
  };

  filters: {
    memberId: string;
    channel: '' | NotificationChannel;
    status: '' | NotificationStatus;
  } = {
    memberId: '',
    channel: '',
    status: ''
  };

  notifications: NotificationListItem[] = [];
  selectedNotification: NotificationListItem | null = null;

  constructor(
    private notificationApi: NotificationApiService,
    private memberApi: MemberApiService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadMembers();
    this.loadHistory();
  }

  private applyQueryParamsPrefill() {
    const query = this.route.snapshot.queryParamMap;
    const memberId = query.get('memberId');
    const channel = query.get('channel') as NotificationChannel | null;
    const type = query.get('type') as NotificationType | null;
    const recipient = query.get('recipient');
    const subject = query.get('subject');
    const message = query.get('message');

    if (memberId) {
      this.composeForm.memberId = memberId;
      this.filters.memberId = memberId;
    }
    if (channel && this.channelOptions.includes(channel)) {
      this.composeForm.channel = channel;
    }
    if (type && this.typeOptions.includes(type)) {
      this.composeForm.type = type;
    }
    if (recipient) {
      this.composeForm.recipient = recipient;
    }
    if (subject) {
      this.composeForm.subject = subject;
    }
    if (message) {
      this.composeForm.message = message;
    }
  }

  loadMembers() {
    this.membersLoading = true;
    this.memberApi.getMembers().subscribe({
      next: (res: any[]) => {
        this.members = res || [];
        this.membersLoading = false;
        this.applyQueryParamsPrefill();
        this.syncRecipientFromMember();
      },
      error: () => {
        this.membersLoading = false;
      }
    });
  }

  onComposeMemberChange() {
    this.syncRecipientFromMember();
  }

  onComposeChannelChange() {
    this.syncRecipientFromMember();
    if (this.composeForm.channel === 'SMS') {
      this.composeForm.subject = '';
    } else if (!this.composeForm.subject.trim()) {
      this.composeForm.subject = this.getDefaultSubject(this.composeForm.type);
    }
  }

  onComposeTypeChange() {
    if (this.composeForm.channel === 'EMAIL') {
      this.composeForm.subject = this.getDefaultSubject(this.composeForm.type);
    }
    if (!this.composeForm.message.trim()) {
      this.composeForm.message = this.getDefaultMessage(this.composeForm.type);
    }
  }

  private syncRecipientFromMember() {
    const member = this.members.find((m) => m.id === this.composeForm.memberId);
    if (!member) return;

    const recipient = this.composeForm.channel === 'EMAIL' ? member.email : member.phone;
    if (recipient) {
      this.composeForm.recipient = recipient;
    }
  }

  sendNotification() {
    this.error = null;
    this.sendMessage = null;

    if (!this.composeForm.memberId) {
      this.error = 'Member is required.';
      return;
    }
    if (!this.composeForm.recipient.trim()) {
      this.error = 'Recipient is required.';
      return;
    }
    if (!this.composeForm.message.trim()) {
      this.error = 'Message is required.';
      return;
    }
    if (this.composeForm.channel === 'EMAIL' && !this.composeForm.subject.trim()) {
      this.error = 'Subject is required for EMAIL notifications.';
      return;
    }

    const payload: SendNotificationPayload = {
      memberId: this.composeForm.memberId,
      channel: this.composeForm.channel,
      type: this.composeForm.type,
      recipient: this.composeForm.recipient.trim(),
      message: this.composeForm.message.trim(),
      ...(this.composeForm.channel === 'EMAIL' ? { subject: this.composeForm.subject.trim() } : {})
    };

    this.sending = true;
    this.notificationApi.send(payload).subscribe({
      next: (res) => {
        this.sending = false;
        this.sendMessage = `Notification queued with status ${res.status}`;
        this.loadHistory();
      },
      error: (err) => {
        this.sending = false;
        this.error = err?.error?.message || 'Failed to send notification.';
      }
    });
  }

  loadHistory() {
    this.loadingHistory = true;
    this.error = null;

    this.notificationApi
      .getAll({
        memberId: this.filters.memberId || null,
        channel: this.filters.channel || null,
        status: this.filters.status || null
      })
      .subscribe({
        next: (res) => {
          this.notifications = [...(res || [])].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          this.loadingHistory = false;
        },
        error: (err) => {
          this.loadingHistory = false;
          this.error = err?.error?.message || 'Failed to load notifications.';
        }
      });
  }

  viewDetails(notificationId: string) {
    this.loadingDetails = true;
    this.notificationApi.getById(notificationId).subscribe({
      next: (res) => {
        this.selectedNotification = res;
        this.loadingDetails = false;
      },
      error: (err) => {
        this.loadingDetails = false;
        this.error = err?.error?.message || 'Failed to load notification details.';
      }
    });
  }

  clearFilters() {
    this.filters = {
      memberId: '',
      channel: '',
      status: ''
    };
    this.loadHistory();
  }

  getMemberName(memberId: string): string {
    const member = this.members.find((m) => m.id === memberId);
    return member?.fullName || memberId;
  }

  formatDate(value: string): string {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  }

  private getDefaultSubject(type: NotificationType): string {
    if (type === 'WELCOME') return 'Welcome to your program';
    if (type === 'PAYMENT_REMINDER') return 'Payment reminder';
    return 'Notification from your coach';
  }

  private getDefaultMessage(type: NotificationType): string {
    if (type === 'WELCOME') return 'Welcome to the program.';
    if (type === 'PAYMENT_REMINDER') return 'Friendly reminder: your payment is due.';
    return 'You have a new update from your coach.';
  }
}

