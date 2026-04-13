import Image from "next/image";
import Link from "next/link";

import { storeShellContent, storeShellInset } from "@/config/storeShell";

const QUICK_LINKS = [
  { href: "/", label: "Início" },
  { href: "/categorias", label: "Categorias" },
  { href: "/produtos", label: "Produtos" },
  { href: "/sobre", label: "Sobre nós" },
] as const;

const SOCIAL = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  youtube: "https://www.youtube.com/",
} as const;

function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconYoutube({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const socialBtnClass =
  "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={`bg-[#243447] text-white/95 ${storeShellInset}`}>
      <div className={`${storeShellContent} py-12 sm:py-14`}>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="max-w-sm space-y-4">
            <div>
              <p className="text-3xl font-bold italic tracking-wide text-white sm:text-4xl">ACCORSI</p>
              <p className="text-sm font-normal text-white/90 sm:text-base">auto peças</p>
            </div>
            <p className="text-sm leading-relaxed text-white/90">
              A Accorsi Auto Peças é sua parceira confiável em peças automotivas. Qualidade e variedade para o seu
              veículo.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-base font-bold text-store-accent">Links rápidos</h2>
            <ul className="space-y-2 text-sm">
              {QUICK_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-white/90 transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-base font-bold text-store-accent">Contato</h2>
            <ul className="space-y-3 text-sm text-white/90">
              <li className="flex gap-3">
                <IconPhone className="mt-0.5 h-5 w-5 shrink-0 text-store-accent" />
                <a href="tel:+551112345678" className="transition hover:text-white">
                  (11) 1234-5678
                </a>
              </li>
              <li className="flex gap-3">
                <IconMail className="mt-0.5 h-5 w-5 shrink-0 text-store-accent" />
                <a href="mailto:contato@accorsi.com.br" className="transition hover:text-white">
                  contato@accorsi.com.br
                </a>
              </li>
              <li className="flex gap-3">
                <IconMapPin className="mt-0.5 h-5 w-5 shrink-0 text-store-accent" />
                <span>Rua das Peças, 123 — Centro, São Paulo — SP</span>
              </li>
            </ul>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="mb-4 text-base font-bold text-store-accent">Horário de funcionamento</h2>
              <div className="flex gap-3 text-sm text-white/90">
                <IconClock className="mt-0.5 h-5 w-5 shrink-0 text-store-accent" />
                <div className="space-y-1">
                  <p>Segunda a sexta: 8h — 18h</p>
                  <p>Sábado: 8h — 13h</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-base font-bold text-white">Redes sociais</h2>
              <div className="flex flex-wrap gap-3">
                <a
                  href={SOCIAL.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={socialBtnClass}
                  aria-label="Facebook"
                >
                  <Image
                    src="/icons/footer/facebook.png"
                    alt=""
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] object-contain"
                  />
                </a>
                <a
                  href={SOCIAL.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={socialBtnClass}
                  aria-label="Instagram"
                >
                  <Image
                    src="/icons/footer/instagram.png"
                    alt=""
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] object-contain"
                  />
                </a>
                <a
                  href={SOCIAL.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={socialBtnClass}
                  aria-label="YouTube"
                >
                  <IconYoutube className="h-6 w-6" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/15 pt-6">
          <p className="text-center text-xs text-white/55 sm:text-sm">
            © {year} Accorsi Auto Peças. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
