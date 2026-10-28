import React from 'react';
import { ArrowUpRight, Building2, CalendarClock, Clock, LogOut, Printer } from 'lucide-react';
import type { PortalSession, PortalTenant } from '../../lib/auth';
import { formatTrialEnd, PRODUCT_CATALOG, productUrl, type ProductInfo } from '../../lib/products';

interface AccountSectionProps {
  session: PortalSession;
  onSignOut: () => void;
  onOpenContact: () => void;
}

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  'check-printing': <Printer className="w-5 h-5" />,
  'clock-in-clock-out': <Clock className="w-5 h-5" />,
};

// After sign-up or sign-in: each company the person belongs to, and for each product
// whether the company has it (Open) or not (Contact us; online purchase comes later).
export const AccountSection: React.FC<AccountSectionProps> = ({ session, onSignOut, onOpenContact }) => {
  return (
    <div className="bg-slate-50 min-h-[75vh] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-widest text-indigo-600">Your account</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome, {session.user.fullName}
            </h1>
            <p className="text-sm text-slate-500">Signed in as {session.user.email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-sm font-semibold text-slate-600 hover:text-red-600 px-4 py-2 border border-slate-200 rounded-full bg-white cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {session.tenants.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Your account isn't part of an active company. If your company was closed or suspended, contact us.
          </div>
        ) : (
          session.tenants.map((tenant) => (
            <TenantProducts key={tenant.tenantId} tenant={tenant} onOpenContact={onOpenContact} />
          ))
        )}
      </div>
    </div>
  );
};

function TenantProducts({ tenant, onOpenContact }: { tenant: PortalTenant; onOpenContact: () => void }) {
  const isOwner = tenant.role === 'OWNER';
  return (
    <section className="space-y-4" aria-label={tenant.tenantName}>
      <div className="flex items-center gap-2 text-slate-800">
        <Building2 className="w-4 h-4 text-slate-400" />
        <h2 className="text-lg font-bold">{tenant.tenantName}</h2>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
          {tenant.role.toLowerCase()}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRODUCT_CATALOG.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            access={tenant.products.find((p) => p.slug === product.slug)}
            tenantId={tenant.tenantId}
            isOwner={isOwner}
            onOpenContact={onOpenContact}
          />
        ))}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  access,
  tenantId,
  isOwner,
  onOpenContact,
}: {
  product: ProductInfo;
  access: PortalTenant['products'][number] | undefined;
  tenantId: string;
  isOwner: boolean;
  onOpenContact: () => void;
}) {
  const url = productUrl(product, import.meta.env, tenantId);
  const trialEnds = access?.status === 'TRIALING' ? formatTrialEnd(access.trialEndsAt) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${access ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
          {PRODUCT_ICONS[product.slug]}
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-slate-900">{product.name}</h3>
          <p className="text-sm text-slate-500">{product.description}</p>
        </div>
      </div>

      {access ? (
        <>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
            {access.status === 'TRIALING' ? (trialEnds ? `Free trial · ends ${trialEnds}` : 'Free trial') : 'Active'}
          </p>
          {product.slug === 'check-printing' && isOwner && (
            <p className="text-xs text-slate-500">
              First time? You'll create a workspace for your business, then add a bank account and your team.
            </p>
          )}
          {url ? (
            <a
              href={url}
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Open {product.name}
              <ArrowUpRight className="w-4 h-4" />
            </a>
          ) : (
            <p className="mt-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {product.name} isn't reachable from this site yet. Please contact support.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-slate-500">Not included in your company's plan yet.</p>
          <button
            onClick={onOpenContact}
            className="mt-auto inline-flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 cursor-pointer"
          >
            Contact us to add it
          </button>
        </>
      )}
    </div>
  );
}
