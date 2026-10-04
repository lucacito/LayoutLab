'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { PRICING, getTier, tierSiteLimit, formatUsd, proratedUpgradeCents } from '@/lib/pricing/config';
import type { StoredLicenseStatus } from '@/lib/license-server/core'; // type only: core.ts imports node:crypto and must not reach the client bundle

interface LicenseTierCardProps {
  productTitle: string;
  license: {
    id: string;
    productSlug: string;
    licenseKey: string;
    status: StoredLicenseStatus;
    currentPeriodEnd: Date | null;
    activeSites: string[];
    tier: string | null;
    founding: boolean;
    lifetime: boolean;
    trial: boolean;
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', past_due: 'Payment issue, update billing',
  expired: 'Expired', canceled: 'Canceled', revoked: 'Revoked',
};

const RENEWING_STATUSES = new Set(['active', 'past_due']);

export function LicenseTierCard({ license, productTitle }: LicenseTierCardProps) {
  const [freeloading, setFreeloading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Only show tier card for AI Editor product
  const isAiEditor = license.productSlug === PRICING.product;
  const tierData = license.tier ? getTier(license.tier) : null;
  const sitesAllowed = tierData ? tierSiteLimit(license.tier) : null;
  const sitesUsed = license.activeSites.length;

  const handleFreeSlot = async (siteUrl: string) => {
    setFreeloading(true);
    try {
      const res = await fetch('/api/license/free-site', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: license.id, siteUrl }),
      });
      if (res.ok) {
        // Reload the page to see the updated list
        window.location.reload();
      } else {
        setProblem('That site could not be freed. Try again, or email support@divi5lab.com.');
      }
    } catch (err) {
      console.error('Free slot failed:', err);
      setProblem('That site could not be freed. Try again, or email support@divi5lab.com.');
    } finally {
      setFreeloading(false);
    }
  };

  const handleUpgrade = async (newTier: string, dueToday: string | null) => {
    const label = getTier(newTier)?.label ?? newTier;
    const ok = window.confirm(
      `Upgrade to ${label}? Your card on file is charged${dueToday ? ` about ${dueToday}` : ' the prorated difference'} now, for the rest of your current term.`,
    );
    if (!ok) return;
    setProblem(null);
    setUpgrading(true);
    try {
      const res = await fetch('/api/billing/change-tier', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: license.id, tier: newTier }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        setProblem('The upgrade could not be completed, and you have not been charged for it. Check your card in the billing page, or email support@divi5lab.com.');
      }
    } catch (err) {
      console.error('Upgrade failed:', err);
      setProblem('The upgrade could not be completed. Try again, or email support@divi5lab.com.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-body font-semibold text-navy">
              {productTitle}
            </div>
            {isAiEditor && tierData && (
              <div className="mt-1 text-small font-medium text-action">{tierData.label}</div>
            )}
            <code className="mt-1 block text-small text-muted">{license.licenseKey}</code>
          </div>
          <a
            href={`/api/plugin/download?product=${encodeURIComponent(license.productSlug)}&key=${encodeURIComponent(license.licenseKey)}`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110"
          >
            Download Pro
          </a>
        </div>

        {/* Status and Expiry */}
        <div className="text-small text-muted">
          {license.trial ? 'Free trial' : (STATUS_LABEL[license.status] ?? license.status)}
          {license.lifetime
            ? ' · Lifetime'
            : license.currentPeriodEnd
              ? RENEWING_STATUSES.has(license.status)
                ? ` · renews ${formatDate(license.currentPeriodEnd)}`
                : ` · ended ${formatDate(license.currentPeriodEnd)}`
              : ''}
        </div>

        {/* Badges */}
        {isAiEditor && (
          <div className="flex flex-wrap gap-2">
            {license.founding && (
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-small font-medium text-amber-900">
                Founding price locked
              </span>
            )}
            {license.lifetime && (
              <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-small font-medium text-green-900">
                Lifetime
              </span>
            )}
          </div>
        )}

        {/* Tier-specific info */}
        {isAiEditor && tierData && sitesAllowed !== undefined && (
          <div className="rounded-sm bg-mist p-2 text-small">
            Sites:{' '}
            {sitesAllowed === null ? (
              <span className="font-semibold">{sitesUsed} (unlimited)</span>
            ) : (
              <span className={sitesUsed >= sitesAllowed ? 'font-semibold text-red-600' : 'font-semibold'}>
                {sitesUsed} of {sitesAllowed}
              </span>
            )}
          </div>
        )}

        {/* Sites list */}
        {license.activeSites.length > 0 && (
          <div className="rounded-sm bg-mist p-2">
            <div className="text-small font-medium text-navy">Active sites:</div>
            <ul className="mt-1 space-y-1">
              {license.activeSites.map((site) => (
                <li key={site} className="flex items-center justify-between gap-2 text-small text-muted">
                  <code>{site}</code>
                  {isAiEditor && sitesAllowed !== null && sitesUsed >= sitesAllowed && (
                    <button
                      onClick={() => handleFreeSlot(site)}
                      disabled={freeloading}
                      className="whitespace-nowrap text-small text-action hover:underline disabled:opacity-50"
                    >
                      Free this slot
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upgrade options */}
        {isAiEditor && tierData && !license.lifetime && !license.trial && license.status === 'active' && (
          <div className="border-t border-border pt-3">
            <div className="text-small font-medium text-navy mb-2">Upgrade to higher tier:</div>
            <div className="flex flex-wrap gap-2">
              {PRICING.tiers.map((t) => {
                if (t.id === license.tier) return null; // Don't show current tier
                if (PRICING.tiers.findIndex((x) => x.id === t.id) <= PRICING.tiers.findIndex((x) => x.id === license.tier!)) {
                  return null; // Don't show lower tiers
                }

                // Calculate prorated cost
                const oldTier = getTier(license.tier!);
                const remainingMs = license.currentPeriodEnd
                  ? license.currentPeriodEnd.getTime() - new Date().getTime()
                  : 365 * 24 * 60 * 60 * 1000;
                const periodMs = 365 * 24 * 60 * 60 * 1000;
                const proratedCents = proratedUpgradeCents(oldTier!.priceCents, t.priceCents, remainingMs, periodMs);

                return (
                  <button
                    key={t.id}
                    onClick={() => handleUpgrade(t.id, proratedCents > 0 ? formatUsd(proratedCents) : null)}
                    disabled={upgrading}
                    className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-small font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {t.label}
                    {proratedCents > 0 && (
                      <span className="ml-2 text-small text-blue-200">{formatUsd(proratedCents)} due today (approx.)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {problem && <p className="text-small text-red-600" role="alert">{problem}</p>}

        {/* Billing portal: change card, see invoices, cancel */}
        {isAiEditor && !license.lifetime && (
          <div className="text-small">
            <Link href={PRICING.urls.billing} className="text-action hover:underline">
              Billing, card and cancellation
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
