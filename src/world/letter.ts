/**
 * The finale letter. A thin parchment envelope with a red wax seal drifts
 * down; `setOpen` (0..1) breaks the seal, lifts the flap, slides the letter
 * out, then lets the envelope fall away so only the crisp, readable letter
 * remains floating in the air.
 */
import * as THREE from 'three';
import { portfolio } from '../content/portfolio';

export interface Letter {
  group: THREE.Group;
  setOpen(v: number): void;
}

const INK = '#22140a';

/** Clean parchment (smooth gradient + soft edge burn, no noise). */
function paper(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, '#f6ead0');
  grd.addColorStop(1, '#ead6ae');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  edge.addColorStop(0, 'rgba(120,80,30,0)');
  edge.addColorStop(1, 'rgba(120,80,30,0.28)');
  g.fillStyle = edge;
  g.fillRect(0, 0, w, h);
  return { c, g };
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function envelopeFront() {
  const { c, g } = paper(1024, 680);
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.font = 'italic 64px "IM Fell English", Georgia, serif';
  g.fillText('To whoever walked all the way,', 512, 300);
  g.font = '44px "Cormorant Garamond", Georgia, serif';
  g.fillText('The Great Hall · Hogwarts Castle', 512, 380);
  g.font = 'italic 38px "Cormorant Garamond", Georgia, serif';
  g.fillStyle = '#6a3a1a';
  g.fillText('by owl post', 512, 450);
  return tex(c);
}

function envelopeBack() {
  const { c, g } = paper(1024, 680);
  g.strokeStyle = 'rgba(90,55,20,0.5)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 680);
  g.lineTo(512, 330);
  g.lineTo(1024, 680);
  g.moveTo(0, 0);
  g.lineTo(440, 360);
  g.moveTo(1024, 0);
  g.lineTo(584, 360);
  g.stroke();
  const shade = g.createLinearGradient(0, 680, 0, 330);
  shade.addColorStop(0, 'rgba(90,55,20,0.14)');
  shade.addColorStop(1, 'rgba(90,55,20,0)');
  g.fillStyle = shade;
  g.beginPath();
  g.moveTo(0, 680);
  g.lineTo(512, 330);
  g.lineTo(1024, 680);
  g.fill();
  return tex(c);
}

/** The letter: large, high-contrast lettering so it reads at a distance. */
function letterSheet() {
  const W = 1024, H = 1360;
  const { c, g } = paper(W, H);
  g.textAlign = 'center';
  g.fillStyle = '#8a3a14';
  g.font = '600 40px Cinzel, Georgia, serif';
  g.fillText('L U M O S   M A X I M A', W / 2, 130);
  g.strokeStyle = 'rgba(138,58,20,0.5)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(W / 2 - 220, 165);
  g.lineTo(W / 2 + 220, 165);
  g.stroke();
  g.fillStyle = INK;
  g.font = '120px "IM Fell English", Georgia, serif';
  g.fillText(portfolio.contact.heading, W / 2, 340);
  g.font = 'italic 58px "Cormorant Garamond", Georgia, serif';
  g.fillStyle = '#4a2a14';
  g.fillText(portfolio.contact.email, W / 2, 490);
  if (portfolio.contact.phone) g.fillText(portfolio.contact.phone, W / 2, 570);
  g.font = '600 54px "Cormorant Garamond", Georgia, serif';
  g.fillStyle = INK;
  let y = 700;
  for (const l of portfolio.contact.links.filter((x) => x.url)) {
    g.fillText('✦  ' + l.label, W / 2, y);
    y += 84;
  }
  g.font = 'italic 64px "IM Fell English", Georgia, serif';
  g.fillText(portfolio.contact.signature, W / 2, H - 150);
  return tex(c);
}

export function buildLetter(): Letter {
  const W = 1.1, H = 0.73;
  const group = new THREE.Group();
  const env = new THREE.Group(); // everything that falls away at the end
  group.add(env);
  const mk = (map: THREE.Texture, side: THREE.Side = THREE.FrontSide) =>
    new THREE.MeshStandardMaterial({ map, roughness: 1, side, transparent: true, emissive: 0xfff0d8, emissiveMap: map, emissiveIntensity: 0.18 });
  const frontMat = mk(envelopeFront());
  const backMat = mk(envelopeBack());
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), frontMat);
  front.position.z = 0.004;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), backMat);
  back.rotation.y = Math.PI;
  back.position.z = -0.004;
  env.add(front, back);

  // flap, hinged at the top edge on the back
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-W / 2, 0);
  flapShape.lineTo(W / 2, 0);
  flapShape.lineTo(0, -H * 0.6);
  flapShape.lineTo(-W / 2, 0);
  const flapMat = new THREE.MeshStandardMaterial({ color: 0xe8d6b0, roughness: 1, side: THREE.DoubleSide, transparent: true, emissive: 0xfff0d8, emissiveIntensity: 0.12 });
  const hinge = new THREE.Group();
  hinge.position.set(0, H / 2, -0.008);
  hinge.add(new THREE.Mesh(new THREE.ShapeGeometry(flapShape), flapMat));
  env.add(hinge);

  // wax seal on the flap's point
  const seal = new THREE.Group();
  const waxMat = new THREE.MeshStandardMaterial({ color: 0x9a1820, roughness: 0.5, transparent: true });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.018, 28).rotateX(Math.PI / 2), waxMat);
  seal.add(disc);
  const sc = document.createElement('canvas');
  sc.width = sc.height = 256;
  const sg = sc.getContext('2d')!;
  sg.fillStyle = '#9a1820';
  sg.fillRect(0, 0, 256, 256);
  sg.strokeStyle = '#d0505a';
  sg.lineWidth = 8;
  sg.beginPath();
  sg.arc(128, 128, 100, 0, Math.PI * 2);
  sg.stroke();
  sg.fillStyle = '#e06a70';
  sg.font = '700 140px Cinzel, Georgia, serif';
  sg.textAlign = 'center';
  sg.textBaseline = 'middle';
  sg.fillText(portfolio.name.trim()[0] ?? 'H', 128, 136);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex(sc), roughness: 0.5, transparent: true });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.068, 28), faceMat);
  face.rotation.y = Math.PI;
  face.position.z = -0.01;
  seal.add(face);
  seal.position.set(0, -H * 0.6, -0.012);
  hinge.add(seal);

  // the letter, tucked inside; faces the same way as the back (the viewer, once turned)
  const sheetMat = new THREE.MeshStandardMaterial({ map: letterSheet(), roughness: 1, side: THREE.DoubleSide, emissive: 0xfff4e0, emissiveIntensity: 0.22 });
  sheetMat.emissiveMap = sheetMat.map;
  const sheetGeo = new THREE.PlaneGeometry(W * 0.92, W * 0.92 * (1360 / 1024), 16, 1);
  const sp = sheetGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, -Math.pow(Math.abs(sp.getX(i)) / (W * 0.46), 2) * 0.03);
  sheetGeo.computeVertexNormals();
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.rotation.y = Math.PI;
  sheet.position.set(0, 0, -0.002);
  sheet.scale.setScalar(0.98);
  group.add(sheet);
  const sheetH = W * 0.92 * (1360 / 1024);

  const fadeMats = [frontMat, backMat, flapMat, waxMat, faceMat];
  const ss = THREE.MathUtils.smoothstep;
  return {
    group,
    setOpen(v) {
      hinge.rotation.x = -ss(v, 0.04, 0.32) * 2.7;
      seal.scale.setScalar(1 - ss(v, 0, 0.1) * 0.2);
      // slide up out of the envelope
      const slide = ss(v, 0.28, 0.62);
      sheet.position.y = slide * (sheetH * 0.62);
      // lift free toward the viewer and settle centred, a little larger
      const free = ss(v, 0.6, 1);
      sheet.position.y = THREE.MathUtils.lerp(sheet.position.y, 0.12, free);
      sheet.position.z = -0.002 - free * 0.35;
      sheet.scale.setScalar(0.98 + free * 0.1);
      // the envelope drops away and fades
      env.position.y = -free * 0.9;
      env.rotation.z = free * 0.25;
      for (const m of fadeMats) m.opacity = 1 - ss(v, 0.7, 0.98);
      env.visible = v < 0.99;
    },
  };
}
