/*
 * Replay MVP — Caixa robusta para ESP8266 NodeMCU + Botão Arcade 30mm
 * ----------------------------------------------------------------------
 * Projeto paramétrico em OpenSCAD (https://openscad.org — gratuito).
 *
 * Abra este arquivo, aperte F5 pra pré-visualizar, F6 pra renderizar,
 * F7 pra exportar STL.
 *
 * Parts:
 *   - body()  -> corpo principal (com furo do botão e USB)
 *   - lid()   -> tampa inferior com standoffs pro NodeMCU
 *   - bumper()-> batentes de TPU opcional (cantos, absorve quedas)
 *
 * Na seção RENDER, comente/descomente o módulo que você quer exportar.
 *
 * Montagem:
 *   1. Botão arcade 30mm entra pelo furo superior; trava com o anel rosca.
 *   2. NodeMCU apoia nos 4 pinos (standoffs) da tampa inferior.
 *   3. Ligue um fio do terminal do botão ao pino D1 do NodeMCU,
 *      o outro terminal ao GND.
 *   4. Feche com 4 parafusos M3x10 pelos cantos da tampa.
 *   5. Coloque cordão de silicone 2mm no canal da gaxeta antes de fechar
 *      (ou passe silicone transparente no rim).
 *   6. USB micro sai pela lateral. Use uma capinha/flap de borracha ou
 *      plug de silicone quando não estiver em uso.
 *
 * Impressão:
 *   - Material: ASA (melhor pra sol/UV) ou PETG (bom pra chuva + queda).
 *     PLA não é recomendado para exposição ao sol (amolece >55 C).
 *   - Altura de camada: 0.2 mm
 *   - Perímetros / paredes: 4  (a caixa fica bem rígida)
 *   - Preenchimento: 30-40 % gyroid
 *   - Orientação do body: TOPO PRA BAIXO (face com furo do botão
 *     apoiada na mesa) — não precisa de suporte.
 *   - Orientação da lid: face lisa pra baixo.
 *   - Brim: 5 mm (evita descolar pelo peso)
 */

// =======================================================================
//  PARÂMETROS  (ajuste aqui)
// =======================================================================
$fn = 72;                         // resolução dos círculos

// --- dimensões internas ---------------------------------------------------
in_w = 90;                         // largura interna (X)
in_d = 70;                         // profundidade interna (Y)
in_h = 50;                         // altura interna (Z)

// --- espessuras e cantos --------------------------------------------------
wall      = 4.0;                   // parede lateral (grossa = robusta)
floor_t   = 4.0;                   // teto e fundo
corner_r  = 7;                     // raio dos cantos (arredondado = aguenta queda)

// --- botão arcade (padrão 30 mm / Sanwa-style) ----------------------------
btn_hole      = 28;                // diâmetro do furo (padrão: 28 mm)
btn_chamfer   = 1.0;               // chanfro decorativo ao redor do furo

// --- USB micro (do NodeMCU) -----------------------------------------------
usb_w  = 13;                       // largura do rasgo
usb_h  = 8;                        // altura
usb_z  = 18;                       // altura do centro do rasgo (desde base)

// --- parafusos de fechamento ---------------------------------------------
screw_d       = 3.3;               // clearance M3
screw_boss_d  = 9;                 // diâmetro da bucha (bosse) de parafuso
screw_boss_h  = 12;                // altura da bosse

// --- suportes do NodeMCU (PCB 58 x 31 mm aprox.) -------------------------
pcb_w = 58;
pcb_d = 31;
standoff_d = 5;                    // pino-guia (encaixa na lateral do PCB)
standoff_h = 6;

// --- gaxeta (canal para cordão de silicone 2 mm) -------------------------
gasket_w     = 2.4;
gasket_depth = 1.5;

// --- abas de fixação em parede (remova se não quiser) --------------------
ear_enable = true;
ear_l      = 18;
ear_t      = 5;
ear_hole   = 5;                    // parafuso de fixação na parede

// =======================================================================
//  DERIVADOS
// =======================================================================
out_w = in_w + 2*wall;
out_d = in_d + 2*wall;
out_h = in_h + 2*floor_t;

boss_inset = wall + 4;             // posição das bosses (a partir da parede)
boss_pos = [
    [boss_inset,          boss_inset         ],
    [out_w - boss_inset,  boss_inset         ],
    [boss_inset,          out_d - boss_inset ],
    [out_w - boss_inset,  out_d - boss_inset ]
];

// =======================================================================
//  HELPERS
// =======================================================================
module rounded_box(w, d, h, r) {
    hull() {
        for (x = [r, w-r], y = [r, d-r])
            translate([x, y, 0])
                cylinder(r=r, h=h);
    }
}

module mount_ear() {
    difference() {
        translate([0, -ear_l/2, 0])
            hull() {
                cylinder(d=ear_l, h=ear_t);
                translate([ear_l*0.7, 0, 0])
                    cube([0.1, ear_l, ear_t]);
            }
        translate([ear_l/2, 0, -0.1])
            cylinder(d=ear_hole, h=ear_t + 0.2);
    }
}

// =======================================================================
//  BODY (corpo principal)
// =======================================================================
module body() {
    difference() {
        union() {
            // casca externa (topo fechado, fundo aberto)
            difference() {
                rounded_box(out_w, out_d, out_h, corner_r);
                // cavidade interna, aberta por baixo
                translate([wall, wall, -0.01])
                    rounded_box(
                        out_w - 2*wall,
                        out_d - 2*wall,
                        out_h - floor_t + 0.02,
                        max(0.5, corner_r - wall)
                    );
            }

            // bosses de parafuso (dentro da cavidade, nos 4 cantos)
            for (p = boss_pos)
                translate([p.x, p.y, 0])
                    cylinder(d=screw_boss_d, h=screw_boss_h);

            // abas de fixação
            if (ear_enable) {
                translate([0,            out_d/2, 0]) rotate([0,0,180]) mount_ear();
                translate([out_w,        out_d/2, 0])                    mount_ear();
            }
        }

        // furo do botão arcade no topo
        translate([out_w/2, out_d/2, out_h - floor_t - 0.1])
            cylinder(d=btn_hole, h=floor_t + 1);

        // chanfro decorativo no topo, ao redor do botão
        translate([out_w/2, out_d/2, out_h - btn_chamfer])
            cylinder(d1=btn_hole, d2=btn_hole + 2*btn_chamfer, h=btn_chamfer + 0.01);

        // furo USB micro na lateral esquerda (eixo -X)
        translate([-0.1, out_d/2 - usb_w/2, usb_z])
            cube([wall + 0.2, usb_w, usb_h]);

        // furos dos parafusos (passam pelas bosses)
        for (p = boss_pos)
            translate([p.x, p.y, -0.1])
                cylinder(d=screw_d, h=screw_boss_h + 0.2);

        // canal da gaxeta na base do corpo
        translate([wall + gasket_w, wall + gasket_w, -0.01])
            difference() {
                rounded_box(
                    out_w - 2*(wall + gasket_w),
                    out_d - 2*(wall + gasket_w),
                    gasket_depth,
                    max(0.5, corner_r - wall - gasket_w)
                );
                translate([gasket_w, gasket_w, -0.02])
                    rounded_box(
                        out_w - 2*(wall + 2*gasket_w),
                        out_d - 2*(wall + 2*gasket_w),
                        gasket_depth + 0.1,
                        max(0.3, corner_r - wall - 2*gasket_w)
                    );
            }
    }
}

// =======================================================================
//  LID (tampa inferior com suporte para NodeMCU)
// =======================================================================
module lid() {
    lid_t = floor_t;

    difference() {
        union() {
            // base da tampa
            rounded_box(out_w, out_d, lid_t, corner_r);

            // pinos-guia para o PCB do NodeMCU (segura as laterais)
            sx = (out_w - pcb_w)/2;
            sy = (out_d - pcb_d)/2;
            pcb_guides = [
                [sx - standoff_d/2,       sy + pcb_d/2],
                [sx + pcb_w + standoff_d/2, sy + pcb_d/2],
                [sx + pcb_w/2, sy - standoff_d/2],
                [sx + pcb_w/2, sy + pcb_d + standoff_d/2]
            ];
            for (p = pcb_guides)
                translate([p.x, p.y, lid_t - 0.01])
                    cylinder(d=standoff_d, h=standoff_h);

            // lip que entra no corpo (alinhamento de montagem)
            translate([wall + 0.3, wall + 0.3, lid_t - 0.01])
                difference() {
                    rounded_box(
                        out_w - 2*wall - 0.6,
                        out_d - 2*wall - 0.6,
                        2,
                        max(0.3, corner_r - wall)
                    );
                    translate([1.2, 1.2, -0.1])
                        rounded_box(
                            out_w - 2*wall - 3.0,
                            out_d - 2*wall - 3.0,
                            2.3,
                            max(0.2, corner_r - wall - 1.2)
                        );
                }
        }

        // furos dos parafusos M3 com rebaixo (countersink)
        for (p = boss_pos) {
            translate([p.x, p.y, -0.01])
                cylinder(d=screw_d + 0.4, h=lid_t + 0.2);
            translate([p.x, p.y, -0.01])
                cylinder(d1=6.2, d2=3.4, h=2);
        }
    }
}

// =======================================================================
//  BUMPER (batente de canto opcional, imprima em TPU flexível)
// =======================================================================
module bumper() {
    // 4 cantinhos de TPU que se encaixam nos cantos externos — protege quedas
    bumper_thick = 3;
    bumper_h     = 18;
    bumper_arc   = 28;        // comprimento de cada lado da "cantoneira"

    difference() {
        intersection() {
            // casca externa ligeiramente maior que o corpo
            difference() {
                rounded_box(out_w + 2*bumper_thick, out_d + 2*bumper_thick, bumper_h,
                            corner_r + bumper_thick);
                translate([bumper_thick, bumper_thick, -0.1])
                    rounded_box(out_w, out_d, bumper_h + 0.2, corner_r);
            }
            // fica só com o quadrante de um canto
            translate([0, 0, -0.1])
                cube([bumper_arc + bumper_thick, bumper_arc + bumper_thick, bumper_h + 0.2]);
        }
    }
}

// =======================================================================
//  RENDER — descomente APENAS UM pra exportar STL (F6 + F7)
// =======================================================================

body();
// lid();
// bumper();         // imprima 4 cópias em TPU 95A

// --- pré-visualização montada (só para ver, não exportar) ---------------
// body();
// translate([0, 0, -floor_t - 0.2]) lid();
