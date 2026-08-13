import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";

/**
 * Sonde de vivacité, consommée par le `HEALTHCHECK` Docker et par Dokploy
 * (ADR-002) pour décider si un container est prêt à recevoir du trafic.
 *
 * Volontairement pauvre : elle ne dit que « le process répond ». Elle ne touche
 * pas au disque — une sonde qui échoue parce qu'un fichier est verrouillé ferait
 * redémarrer un serveur en bonne santé.
 */
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check(): { status: "ok"; uptime: number } {
    return { status: "ok", uptime: Math.round(process.uptime()) };
  }
}
