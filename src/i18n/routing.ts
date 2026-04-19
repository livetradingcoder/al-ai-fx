import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'hi', 'bn', 'ur', 'ar', 'de', 'es'],
  defaultLocale: 'en',
  localePrefix: 'as-needed' // Do not prefix URLs when the locale is 'en'
});

export const {Link, redirect, usePathname, useRouter, getPathname} = createNavigation(routing);
