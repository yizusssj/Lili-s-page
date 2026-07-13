export default function AppIcon({ icon: Icon, imageSrc, size = 18, strokeWidth = 1.8 }) {
  if (imageSrc) {
    return <img src={imageSrc} alt="" style={{ width: size, height: size, objectFit: "cover" }} />;
  }

  return <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} />;
}
