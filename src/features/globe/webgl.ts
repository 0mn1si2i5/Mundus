export function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return (
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) !==
      null
    );
  } catch {
    return false;
  }
}
