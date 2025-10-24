type PagePlaceholderProps = {
  title: string;
  description: string;
  hint?: string;
};

export function PagePlaceholder({ title, description, hint }: PagePlaceholderProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-16 md:px-6 md:py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="text-base text-muted-foreground">{description}</p>
      {hint ? <p className="text-sm text-muted-foreground/80">{hint}</p> : null}
    </section>
  );
}
