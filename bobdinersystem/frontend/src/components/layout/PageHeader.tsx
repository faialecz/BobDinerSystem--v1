interface PageHeaderProps {
  title:    string;
  subtitle: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#164163', margin: 0 }}>
        {title}
      </h1>
      <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '2px 0 0' }}>
        {subtitle}
      </p>
    </div>
  );
}
