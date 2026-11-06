export const ReleaseUpdate = ({ label, href, title, children }) => {
  return (
    <Update label={label}>
      <h2>
        <a href={href}>{label}: {title}</a>
      </h2>
      {children}
      <a href={href} className="release-update-read-more">
        Read the full update →
      </a>
    </Update>
  );
};
