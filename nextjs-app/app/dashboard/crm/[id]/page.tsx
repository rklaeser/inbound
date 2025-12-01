import { notFound } from 'next/navigation';
import { getCustomerById } from '@/lib/salesforce-mock';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CrmRecordPage({ params }: Props) {
  const { id } = await params;
  const customer = getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const statusColors = {
    Active: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
    'At-Risk': { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
    Churned: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
  };

  const accountTypeColors = {
    Enterprise: { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' },
    'Mid-Market': { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
    SMB: { bg: 'rgba(161, 161, 161, 0.1)', border: 'rgba(161, 161, 161, 0.2)', text: '#a1a1a1' },
  };

  const statusStyle = statusColors[customer.status];
  const accountStyle = accountTypeColors[customer.accountType];

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="px-8 py-6">
          <Link
            href="/dashboard/leads"
            className="inline-flex items-center gap-1 mb-4 text-sm hover:underline"
            style={{ color: '#888' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Leads
          </Link>
          <div className="flex items-center gap-3">
            <h1 style={{ fontSize: '24px', lineHeight: '1.2', fontWeight: 600, color: '#fafafa' }}>
              {customer.company}
            </h1>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: accountStyle.bg,
                border: `1px solid ${accountStyle.border}`,
                color: accountStyle.text,
              }}
            >
              {customer.accountType}
            </span>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: statusStyle.bg,
                border: `1px solid ${statusStyle.border}`,
                color: statusStyle.text,
              }}
            >
              {customer.status}
            </span>
          </div>
          <p style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>
            CRM Record: {customer.id}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-8 max-w-4xl">
        <div className="grid grid-cols-2 gap-8">
          {/* Contact Info */}
          <div
            className="border rounded-lg p-6"
            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0a0a0a' }}
          >
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fafafa', marginBottom: '16px' }}>
              Contact Information
            </h2>
            <div className="space-y-4">
              <Field label="Name" value={customer.name} />
              <Field label="Email" value={customer.email} isEmail />
              <Field label="Company" value={customer.company} />
            </div>
          </div>

          {/* Account Info */}
          <div
            className="border rounded-lg p-6"
            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0a0a0a' }}
          >
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fafafa', marginBottom: '16px' }}>
              Account Details
            </h2>
            <div className="space-y-4">
              <Field label="Annual Value" value={`$${customer.annualValue.toLocaleString()}`} />
              <Field label="Customer Since" value={new Date(customer.joinedDate).toLocaleDateString()} />
              <Field label="Account Type" value={customer.accountType} />
              <Field label="Status" value={customer.status} />
            </div>
          </div>

          {/* Account Team */}
          <div
            className="border rounded-lg p-6"
            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0a0a0a' }}
          >
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fafafa', marginBottom: '16px' }}>
              Account Team
            </h2>
            <div className="space-y-4">
              <Field label="Account Executive" value={customer.accountTeam} />
              <Field label="AE Email" value={customer.accountTeamEmail} isEmail />
            </div>
          </div>

          {/* Notes */}
          <div
            className="border rounded-lg p-6"
            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0a0a0a' }}
          >
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#fafafa', marginBottom: '16px' }}>
              Notes
            </h2>
            <p style={{ fontSize: '13px', color: '#d4d4d4', lineHeight: '1.6' }}>
              {customer.notes}
            </p>
          </div>
        </div>

        {/* Mock Data Notice */}
        <div
          className="mt-8 border rounded-lg p-4"
          style={{ borderColor: 'rgba(245, 158, 11, 0.2)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}
        >
          <p style={{ fontSize: '12px', color: '#f59e0b' }}>
            This is mock CRM data for demonstration purposes. In production, this would link to your actual Salesforce/HubSpot CRM.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, isEmail }: { label: string; value: string; isEmail?: boolean }) {
  return (
    <div>
      <dt style={{ fontSize: '11px', fontWeight: 500, color: '#737373', marginBottom: '2px' }}>
        {label}
      </dt>
      <dd style={{ fontSize: '14px', color: '#fafafa' }}>
        {isEmail ? (
          <a href={`mailto:${value}`} className="hover:underline" style={{ color: '#0070f3' }}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
