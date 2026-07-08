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
        border: 'none',
        color: 'var(--text-secondary)',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        marginRight: '0.25rem',
        outline: 'none',
        paddingTop: '4px',
        paddingBottom: '4px',
        paddingRight: '4px',
        paddingLeft: '4px'
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
