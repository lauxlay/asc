import type { AnalyzeImportResponse, CommitImportResponse } from "@asc/contracts";
import { type ColumnMapping, IMPORT_FIELDS, type ImportField } from "@asc/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, analyzeImport, commitImport } from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import { SELECT_CLASS_NAME } from "@/lib/customer-type";

/**
 * Import du parc depuis un CSV (spec 004).
 *
 * Deux temps, jamais d'import à l'aveugle : on analyse et on montre ce qui
 * serait créé, puis l'utilisateur confirme. Le fichier reste dans le
 * navigateur entre les deux — le serveur ne garde aucun état d'import.
 */

const FIELD_LABELS: Readonly<Record<ImportField, string>> = {
  siteName: "Nom de l'immeuble",
  addressLine: "Adresse",
  postalCode: "Code postal",
  city: "Ville",
  reference: "Repère de l'appareil",
  commissionedOn: "Mise en service",
  lastStatutoryInspectionOn: "Dernier contrôle technique",
};

const REQUIRED_LABEL: Readonly<Record<ImportField, boolean>> = {
  siteName: true,
  addressLine: true,
  postalCode: true,
  city: true,
  reference: true,
  commissionedOn: false,
  lastStatutoryInspectionOn: false,
};

export function ImportPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();

  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeImportResponse | null>(null);
  /**
   * Correspondance en cours d'édition.
   *
   * Elle vit ici et pas dans la réponse d'analyse : sans quoi deux changements
   * de colonne rapprochés partiraient tous deux de la dernière réponse reçue,
   * et le premier serait perdu.
   */
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [result, setResult] = useState<CommitImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Rang de la dernière analyse demandée, pour ignorer les réponses dépassées. */
  const latestRequest = useRef(0);

  const analyzeMutation = useMutation({
    mutationFn: async ({
      text,
      mapping: requested,
      requestId,
    }: {
      text: string;
      mapping: ColumnMapping | null;
      requestId: number;
    }) => ({ analysis: await analyzeImport(token, text, requested), requestId }),
    onSuccess: ({ analysis: fresh, requestId }) => {
      // Une réponse arrivée dans le désordre ne doit pas écraser un état plus
      // récent : l'utilisateur verrait ses erreurs revenir toutes seules.
      if (requestId !== latestRequest.current) {
        return;
      }
      setAnalysis(fresh);
      setMapping(fresh.mapping);
      setError(null);
    },
    onError: (cause: unknown) => {
      setAnalysis(null);
      setError(cause instanceof Error ? cause.message : "Analyse impossible");
    },
  });

  function analyzeWith(text: string, requested: ColumnMapping | null): void {
    latestRequest.current += 1;
    analyzeMutation.mutate({ text, mapping: requested, requestId: latestRequest.current });
  }

  const commitMutation = useMutation({
    mutationFn: ({ text, mapping }: { text: string; mapping: ColumnMapping }) =>
      commitImport(token, text, mapping),
    onSuccess: async (result) => {
      setResult(result);
      setAnalysis(null);
      // Le parc entier vient de changer : aucune liste en cache n'est encore
      // juste.
      await queryClient.invalidateQueries();
    },
    onError: (cause: unknown) => {
      // Les erreurs ligne à ligne arrivent dans `issues` ; on les réinjecte
      // dans l'analyse affichée pour que l'utilisateur voie la même liste.
      if (cause instanceof ApiError && cause.issues.length > 0) {
        setAnalysis((current) =>
          current === null ? current : { ...current, issues: [...cause.issues] },
        );
      }
      setError(cause instanceof Error ? cause.message : "Import impossible");
    },
  });

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setFileName(file.name);
    setError(null);
    setResult(null);
    setMapping(null);
    void file.text().then((text) => {
      setCsv(text);
      analyzeWith(text, null);
    });
  }

  /** Réaffecte une colonne à partir de la correspondance locale, pas de la réponse. */
  function remap(field: ImportField, column: number | null): void {
    if (mapping === null || csv === null) {
      return;
    }
    const next: ColumnMapping = { ...mapping, [field]: column };
    setMapping(next);
    analyzeWith(csv, next);
  }

  const blocking = analysis !== null && analysis.issues.length > 0;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importer un parc</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Un fichier CSV, une ligne par appareil. Rien n'est importé avant votre confirmation.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="csv-file">Fichier CSV</Label>
        <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} />
        {fileName !== null && (
          <p className="text-sm text-[var(--color-muted-foreground)]">Fichier : {fileName}</p>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      {result !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import terminé</CardTitle>
            <CardDescription data-testid="import-result">
              {result.createdUnitCount} appareil(s) importé(s) dans {result.createdSiteCount}{" "}
              nouvel(s) immeuble(s)
              {result.reusedSiteCount > 0 && ` et ${result.reusedSiteCount} existant(s)`}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/parc">Voir le parc</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {analysis !== null && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Correspondance des colonnes</CardTitle>
              <CardDescription>
                Devinée d'après les en-têtes du fichier — corrigez ce qui ne va pas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`map-${field}`}>
                      {FIELD_LABELS[field]}
                      {REQUIRED_LABEL[field] && (
                        <span className="text-[var(--color-destructive)]"> *</span>
                      )}
                    </Label>
                    <select
                      id={`map-${field}`}
                      className={SELECT_CLASS_NAME}
                      value={mapping?.[field] ?? ""}
                      onChange={(event) =>
                        remap(field, event.target.value === "" ? null : Number(event.target.value))
                      }
                    >
                      <option value="">— aucune colonne —</option>
                      {analysis.headers.map((header, column) => (
                        // L'index EST l'identité de l'option : c'est le numéro
                        // de colonne du fichier, et deux colonnes peuvent
                        // porter le même intitulé.
                        // biome-ignore lint/suspicious/noArrayIndexKey: le rang de la colonne est la clé métier
                        <option key={`${header}-${column}`} value={column}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ce qui serait importé</CardTitle>
              <CardDescription data-testid="import-summary">
                {analysis.rowCount} ligne(s) lue(s) · {analysis.createdSiteCount} immeuble(s)
                créé(s) · {analysis.reusedSiteCount} immeuble(s) réutilisé(s) · {analysis.unitCount}{" "}
                appareil(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.preview.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[var(--color-muted-foreground)]">
                      <tr>
                        <th className="py-1 pr-4 font-medium">Immeuble</th>
                        <th className="py-1 pr-4 font-medium">Adresse</th>
                        <th className="py-1 pr-4 font-medium">Appareil</th>
                        <th className="py-1 font-medium">Mise en service</th>
                      </tr>
                    </thead>
                    <tbody data-testid="import-preview">
                      {analysis.preview.map((row) => (
                        <tr key={row.lineNumber} className="border-t border-[var(--color-border)]">
                          <td className="py-1 pr-4">{row.siteName}</td>
                          <td className="py-1 pr-4">
                            {row.addressLine}, {row.postalCode} {row.city}
                          </td>
                          <td className="py-1 pr-4">{row.reference}</td>
                          <td className="py-1">{row.commissionedOn ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {blocking && (
                <div className="space-y-2">
                  <p
                    data-testid="import-issues-title"
                    className="text-sm font-medium text-[var(--color-destructive)]"
                  >
                    {analysis.issues.length} problème(s) — rien ne sera importé tant qu'ils
                    subsistent.
                  </p>
                  <ul
                    data-testid="import-issues"
                    className="space-y-1 text-sm text-[var(--color-destructive)]"
                  >
                    {analysis.issues.slice(0, 20).map((issue) => (
                      <li key={`${issue.lineNumber ?? "fichier"}-${issue.message}`}>
                        {issue.lineNumber === null ? "Fichier" : `Ligne ${issue.lineNumber}`} :{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                  {analysis.issues.length > 20 && (
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      … et {analysis.issues.length - 20} autre(s).
                    </p>
                  )}
                </div>
              )}

              <Button
                type="button"
                disabled={
                  blocking ||
                  commitMutation.isPending ||
                  analyzeMutation.isPending ||
                  csv === null ||
                  mapping === null
                }
                onClick={() => {
                  // Une analyse en vol laisserait confirmer un aperçu périmé :
                  // le bouton est désactivé le temps qu'elle revienne.
                  if (csv !== null && mapping !== null) {
                    setError(null);
                    commitMutation.mutate({ text: csv, mapping });
                  }
                }}
              >
                {commitMutation.isPending
                  ? "Import…"
                  : `Importer ${analysis.unitCount} appareil(s)`}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
