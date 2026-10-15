/**
 * A sealed letter for the finale: parchment envelope, a hinged flap and a red
 * wax seal. `open` (0..1) breaks the seal, lifts the flap and slides the
 * letter out.
 */
import * as THREE from 'three';
import { parchment } from '../core/textures';
import { portfolio } from '../content/portfolio';

export interface Letter {
  group: THREE.Group;
  setOpen(v: number): void;
}

function envelopeFront() {
  const c = parchment(768, 512, 21);
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a2214';
  g.textAlign = 'center';
  g.font = 'italic 40px "IM Fell English", Georgia, serif';
  g.fillText('To whoever walked all the way,', 384, 230);
  g.font = '30px "Cormorant Garamond", Georgia, serif';
  g.fillText('The Great Hall · Hogwarts Castle', 384, 285);
  g.font = 'italic 26px "Cormorant Garamond", Georgia, serif';
  g.fillText('by owl post', 384, 330);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Back of the envelope: parchment with the side and bottom flaps folded in. */
function envelopeBack() {
  const c = parchment(768, 512, 27);
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(70,45,20,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 512);
  g.lineTo(384, 230);
  g.lineTo(768, 512);
  g.moveTo(0, 0);
  g.lineTo(330, 270);
  g.moveTo(768, 0);
  g.lineTo(438, 270);
  g.stroke();
  const shade = g.createLinearGradient(0, 512, 0, 230);
  shade.addColorStop(0, 'rgba(60,35,10,0.18)');
  shade.addColorStop(1, 'rgba(60,35,10,0)');
  g.fillStyle = shade;
  g.beginPath();
  g.moveTo(0, 512);
  g.lineTo(384, 230);
  g.lineTo(768, 512);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function letterSheet() {
  const c = parchment(512, 680, 33);
  const g = c.getContext('2d')!;
  g.textAlign = 'center';
  g.fillStyle = '#7a3a18';
  g.font = '600 20px Cinzel, Georgia, serif';
  g.fillText('L U M O S   M A X I M A', 256, 70);
  g.fillStyle = '#2a160a';
  g.font = '48px "IM Fell English", Georgia, serif';
  g.fillText(portfolio.contact.heading, 256, 160);
  g.font = 'italic 26px "Cormorant Garamond", Georgia, serif';
  g.fillStyle = '#4a3020';
  g.fillText(portfolio.contact.email, 256, 240);
  g.font = '24px "Cormorant Garamond", Georgia, serif';
  let y = 300;
  for (const l of portfolio.contact.links.filter((x) => x.url)) {
    g.fillText('✦ ' + l.label, 256, y);
    y += 36;
  }
  g.font = 'italic 30px "IM Fell English", Georgia, serif';
  g.fillText(portfolio.contact.signature, 256, 600);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildLetter(): Letter {
  const W = 1.1, H = 0.74;
  const group = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: 0xb8a27a, roughness: 0.85, side: THREE.DoubleSide });
  const front = new THREE.MeshStandardMaterial({ map: envelopeFront(), roughness: 0.85, emissive: 0xffe0b0, emissiveIntensity: 0.12 });
  // back panel (faces the viewer when opened) and front with the address
  const backMat = new THREE.MeshStandardMaterial({ map: envelopeBack(), roughness: 0.85, color: 0xd8c8a4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), [paper, paper, paper, paper, front, backMat]);
  group.add(body);

  // the letter itself, tucked inside; slides up out of the top edge
  const sheetMat = new THREE.MeshStandardMaterial({ map: letterSheet(), roughness: 0.9, emissive: 0xffe2b0, emissiveMap: null, emissiveIntensity: 0.04, side: THREE.DoubleSide, color: 0xd8c8a4 });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, H * 1.25), sheetMat);
  sheet.position.set(0, 0, -0.02);
  sheet.rotation.y = Math.PI; // readable from the back of the envelope
  group.add(sheet);

  // flap hinged at the top edge (on the back side)
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-W / 2, 0);
  flapShape.lineTo(W / 2, 0);
  flapShape.lineTo(0, -H * 0.62);
  flapShape.lineTo(-W / 2, 0);
  const hinge = new THREE.Group();
  hinge.position.set(0, H / 2, -0.012);
  const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), paper);
  hinge.add(flap);
  group.add(hinge);

  // wax seal
  const waxMat = new THREE.MeshStandardMaterial({ color: 0x8a1016, roughness: 0.35, metalness: 0.1 });
  const seal = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.02, 24).rotateX(Math.PI / 2), waxMat);
  seal.add(disc);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a1016';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#c0383a';
  g.font = '700 72px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(portfolio.name.trim()[0] ?? 'H', 64, 68);
  const st = new THREE.CanvasTexture(c);
  st.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshStandardMaterial({ map: st, roughness: 0.4 }));
  face.position.z = -0.011;
  face.rotation.y = Math.PI;
  seal.add(face);
  seal.position.set(0, H / 2 - H * 0.5, -0.025);
  hinge.add(seal);
  seal.position.set(0, -H * 0.5, -0.012);

  return {
    group,
    setOpen(v) {
      const flapK = THREE.MathUtils.smoothstep(v, 0.05, 0.45);
      hinge.rotation.x = -flapK * 2.6;
      const crack = THREE.MathUtils.smoothstep(v, 0.0, 0.12);
      seal.scale.setScalar(1 - crack * 0.15);
      const slide = THREE.MathUtils.smoothstep(v, 0.4, 1);
      sheet.position.y = slide * H * 1.15;
      sheet.position.z = -0.02 - slide * 0.06;
    },
  };
}
