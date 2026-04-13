'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, Button } from '@heroui/react';
import { Menu } from 'lucide-react';
import type { AppModule } from '@/src/lib/access-control';
import { navItems, navSections } from '@/src/components/layout/navigation-config';
import { cn } from '@/src/lib/utils';
import { useMemo, useState } from 'react';

export function MobileNavDrawer({ visibleModules }: { visibleModules: AppModule[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const visibleSet = useMemo(() => new Set(visibleModules), [visibleModules]);

  return (
    <>
      <Button
        isIconOnly
        variant='secondary'
        className='h-10 w-10 rounded-xl border border-[#30465d] bg-[#0f1c2d] text-[#d3e0ef] lg:hidden'
        onPress={() => setOpen(true)}
        aria-label='Deschide navigatia'
      >
        <Menu className='h-5 w-5' />
      </Button>

      <Drawer isOpen={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader className='border-b border-[#2f455c] bg-[#0b1421] text-[#e7f2ff]'>ELTGRUP Manager</DrawerHeader>
          <DrawerBody className='gap-4 bg-[#0b1421] py-4 text-[#e7f2ff]'>
            {navSections.map((section) => {
              const sectionItems = navItems.filter((item) => item.section === section && visibleSet.has(item.module));
              if (!sectionItems.length) return null;
              return (
                <div key={section} className='space-y-2'>
                  <p className='px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86a7c9]'>{section}</p>
                  <div className='space-y-1'>
                    {sectionItems.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
                            active
                              ? 'border-[#3f5772] bg-[#122334] text-[#edf8ff]'
                              : 'border-transparent text-[#b0c8e1] hover:border-[#2e4259] hover:bg-[#111f31]',
                          )}
                        >
                          <Icon className='h-4 w-4' />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
