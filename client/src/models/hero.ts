import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry";
import * as THREE from "three";
import {AnimationAction, AnimationMixer, Group, Object3DEventMap, Scene} from "three";
import { CapsuleInfo } from "../types/main";
import {loadModel} from "../utils/model.ts";
import {Object3D} from "three/src/core/Object3D";
import {ObjectDimensions} from "../../../types/assets.ts";


export class Hero {
    private readonly root: Object3D;
    protected scene: Scene;
    private mixer: AnimationMixer;
    private static dimensions: ObjectDimensions = {
        width: 1.0,
        height: 1.0,
        depth: 0.2
    };
    private currentAnimation: string;
    private action: AnimationAction;

    constructor(scene: Scene, object: Group<Object3DEventMap>|undefined|null) {
        const root = object || this.createRoundedBox();
        this.mixer = new AnimationMixer( root );

        // Play a specific animation
        this.currentAnimation = 'Idle';
        const clip = THREE.AnimationClip.findByName( root.animations, 'Idle' );
        this.action = this.mixer.clipAction( clip );

        if (this.action) {
            this.action.play();
        }

        this.scene = scene;
        this.root = root;
        this.applyCapsuleInfo();
    }
    update(delta: number) {
        this.mixer.update( delta );
    }

    createRoundedBox() {
        const geometry = new RoundedBoxGeometry(
            Hero.dimensions.width, Hero.dimensions.height, Hero.dimensions.depth, 10, 0.5 );
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            wireframe: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.geometry.translate( 0, - 0.5, 0 );

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material.shadowSide = 2;
        return mesh;
    }

    applyCapsuleInfo() {
        if (this.root) {
            // @ts-ignore
            this.root.capsuleInfo = {
                radius: 0.5,
                segment: new THREE.Line3( new THREE.Vector3(), new THREE.Vector3( 0, - 1.0, 0.0 ) )
            } as CapsuleInfo;
        }
    }

    static async Create(scene: Scene) {
        const group = await loadModel.gltf('./assets/characters/mixamo_leonard.glb');
        let player = null;
        if (group) {
            player = group.scene;
            player.animations = group.animations;
            player.castShadow = true;
            player.receiveShadow = false;

            player.children[0].position.set(0,-1.5,0);
            /*group.traverse((object: Object3D|Mesh) => {
                if (object instanceof Mesh) {
                    object.castShadow = true;
                    object.receiveShadow = false;

                    const boundingBox = new THREE.Box3().setFromObject(group);
                    const currentDimensions = boundingBox.getSize(new THREE.Vector3());

                    const scaleX = Hero.dimensions.width / currentDimensions.x;
                    const scaleY = Hero.dimensions.height / currentDimensions.y;
                    const scaleZ = Hero.dimensions.depth / currentDimensions.z;
                    object.scale.set(scaleX, scaleY, scaleZ);
                    object.position.set(0,0,0);
                }
            });*/
        }
        return new Hero(scene, player)
    }

    getObject() {
        return this.root;
    }

    moveTo(x: number, y: number, z: number) {
        const tempVector = new THREE.Vector3();
        tempVector.set(x, y, z)
        this.root.lookAt(tempVector);
        this.root.position.set(x, y, z)
    }

    addToScene(): Hero {
        this.scene.add(this.root);
        return this;
    }

    getPosition() {
        return this.root.position.clone();
    }

    changeAnimation(name: string) {
        if (this.currentAnimation === name) {
            return;
        }
        const clip = THREE.AnimationClip.findByName( this.root.animations, name );
        if (clip) {
            //this.action.stop();
            this.mixer.stopAllAction();

            const action = this.mixer.clipAction( clip );
            if (action) {
                this.currentAnimation = name;
                action.play();
            }
        }
    }
}
