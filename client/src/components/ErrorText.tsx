/** Message d'une erreur (déjà traduit par le client d'API), rien sans erreur. */
export function ErrorText({ error }: Readonly<{ error: Error | null | undefined }>) {
  if (!error) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-red-700">
      {error.message}
    </p>
  );
}
