"use client";

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '../i18n/routing';
import { ChangeEvent, useTransition } from 'react';

export default function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const onSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <select
      defaultValue={locale}
      disabled={isPending}
      onChange={onSelectChange}
      aria-label="Select Language"
      style={{
        background: 'transparent',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        padding: '0.4rem 0.8rem',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        marginRight: '1rem',
        outline: 'none'
      }}
    >
      <option value="en">🇪🇺 EN</option>
      <option value="es">🇪🇸 ES</option>
      <option value="de">🇩🇪 DE</option>
      <option value="ar">🇦🇪 AR</option>
      <option value="hi">🇮🇳 HI</option>
      <option value="bn">🇧🇩 BN</option>
      <option value="ur">🇵🇰 UR</option>
    </select>
  );
}
