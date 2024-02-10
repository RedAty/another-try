import {GLTF, GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import * as THREE from "three";
import {
    ArrowHelper,
    BoxGeometry,
    BufferGeometry,
    Color,
    CylinderGeometry,
    Group,
    Mesh,
    MeshPhongMaterial,
    MeshStandardMaterial,
    NormalBufferAttributes,
    Object3DEventMap,
    PerspectiveCamera,
    Quaternion,
    SphereGeometry,
    TextureLoader,
    Vector3
} from "three";
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader";
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader";
import {Loader} from "three/src/Three";
import {ColladaLoader} from "three/examples/jsm/loaders/ColladaLoader";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader";
import {Object3D} from "three/src/core/Object3D";
import {AssetObject, Circle, Line, Rectangle} from "../../../types/assets.ts";
import {ShadowType} from "../types/controller.ts";
import {MeshOrGroup} from "../types/three.ts";

const genericLoader = (file: File|string, modelLoader: Loader) => {
    return new Promise(resolve => {
        if (file) {
            modelLoader.crossOrigin = '';
            console.log(modelLoader.requestHeader);
            return modelLoader.load(typeof file === "string" ?
                file : URL.createObjectURL(file), resolve);
        }
        return resolve(null);
    });
};

export const loadModel = {
    gltf: async (file: File|string): Promise<GLTF | null> => {
        const object = await genericLoader(file, new GLTFLoader());
        if (object) {
            return object as GLTF;
        }
        return null;
    },
    fbx: async (file: File|string): Promise<Group<Object3DEventMap>|null> => {
        const object = await genericLoader(file, new FBXLoader());
        if (object) {
            return object as Group<Object3DEventMap>;
        }
        return null;
    },
    obj: async (file: File|string): Promise<Group<Object3DEventMap>|null> => {
        const object = await genericLoader(file, new OBJLoader());
        if (object) {
            return object as Group<Object3DEventMap>;
        }
        return null;
    },
    collada: async (file: File|string): Promise<Group<Object3DEventMap>|null> => {
        const object = await genericLoader(file, new ColladaLoader());
        if (object) {
            return object as Group<Object3DEventMap>;
        }
        return null;
    },
    stl: async (file: File|string): Promise<Mesh<BufferGeometry<NormalBufferAttributes>, MeshPhongMaterial, Object3DEventMap>|
        null> => {
        const geometry = await genericLoader(file, new STLLoader());
        if (geometry) {
            const material = new MeshPhongMaterial({ color: 0xff9c7c, specular: 0x494949, shininess: 200 });
            return new Mesh(geometry as BufferGeometry, material);
        }
        return null;
    },
    items: async (objects: AssetObject[]): Promise<MeshOrGroup[]> => {
        const items: MeshOrGroup[] = [];
        for (let i = 0; i < objects.length; i++) {
            const mesh = await getMeshForItem(objects[i]);
            if (mesh) {
                items.push(mesh);
            }
        }
        return items;
    }
}

export const lookAtObject = (models: Object3D, camera: PerspectiveCamera): void => {
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(models);
    const boundingBoxCenter = new THREE.Vector3();
    boundingBox.getCenter(boundingBoxCenter);
    const boundingBoxSize = new THREE.Vector3();
    boundingBox.getSize(boundingBoxSize);
    const boundingBoxDistance = boundingBoxSize.length();

    const cameraPosition = new THREE.Vector3();
    cameraPosition.copy(boundingBoxCenter);

    cameraPosition.z += boundingBoxDistance;
    camera.position.copy(cameraPosition);
    camera.lookAt(boundingBoxCenter);
}

export const getMeshForItem = async (item: AssetObject): Promise<Mesh|Group|null> => {
    let model;

    let material;
    if (item.texture) {
        const textureLoader = new TextureLoader();
        const texture = textureLoader.load(
            item.texture
        );
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        material = new MeshStandardMaterial({
            map: texture,
        });
        material.needsUpdate = true;
    } else {
        material = new MeshStandardMaterial({ color: item.color ?
                new Color(item.color) : 0x000000 })
    }
    let geometry;
    let position1, position2;
    switch (item.type) {
        case "rect":
            const rect = item as Rectangle;
            geometry = new BoxGeometry(rect.w, Math.round((rect.w + rect.h) / 2), rect.h);
            break;
        case "circle":
            geometry = new SphereGeometry((item as Circle).radius, 32, 16);
            break;
        case "line":
            const line = item as Line;
            position1 = new Vector3(line.x1, 0, line.y1);
            position2 = new Vector3(line.x2, 0, line.y2);
            const height = position1.distanceTo(position2);
            geometry = new CylinderGeometry(5, 5, height, 32);
            break;
        case "model":
            if(!item.path) {
                return null;
            }
            if (item.path.endsWith(".gltf") || item.path.endsWith(".glb")) {
                const group = await loadModel.gltf(item.path);
                if (group) {
                    const model = group.scene;
                    const rect = item as Rectangle;
                    const rZ = rect.z || 0;
                    const rX = rect.x || 0;
                    const rY = rect.y || 0;
                    const rW = rect.w || 0;
                    const rH = rect.h || 0;
                    model.position.set(rX + rW / 2, rZ + Math.round((rW + rH) / 2) / 2,
                        rY + rH / 2);
                    return model;
                }
                return null;
            } else if (item.path.endsWith('.fbx')) {
                return await loadModel.fbx(item.path);
            } else if (item.path.endsWith('.obj')) {
                return await loadModel.obj(item.path);
            } else if (item.path.endsWith('.collada')) {
                return await loadModel.collada(item.path);
            } else if (item.path.endsWith('.stl')) {
                return await loadModel.stl(item.path);
            }
            return null;
    }
    model = new Mesh(geometry, material);
    model.castShadow = true; //default is false
    model.receiveShadow = false; //default
    // Position must be ZYX instead of ZXY
    if (model && position1 && position2) {
        const positionMid = new Vector3();
        positionMid.addVectors(position1, position2).multiplyScalar(0.5);
        model.position.copy(positionMid);
        const direction = new Vector3();
        direction.subVectors(position2, position1).normalize();

        const quaternion = new Quaternion();
        quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
        model.setRotationFromQuaternion(quaternion);
    } else if (model && item.type === "rect") {
        const rect = item as Rectangle;
        const z = rect.z || 0;
        model.position.set(rect.x + rect.w / 2, z + Math.round((rect.w + rect.h) / 2) / 2, rect.y + rect.h / 2);
    } else if (model && typeof item.x === 'number' && typeof item.y === "number") {
        model.position.set(item.x, item.z || 0, item.y);
    }
    return model;
};

export const getArrowHelper = (): Group => {
    const arrowGroup = new Group();
    arrowGroup.name = "arrows";
    const xAxisDirection = new Vector3(1, 0, 0);
    const yAxisDirection = new Vector3(0, 1, 0);
    const zAxisDirection = new Vector3(0, 0, 1);

    const origin = new Vector3(0, 0, 0);
    const length = 100;

    const xAxisArrow = new ArrowHelper(xAxisDirection, origin, length, 0xff0000);
    const yAxisArrow = new ArrowHelper(yAxisDirection, origin, length, 0x00ff00);
    const zAxisArrow = new ArrowHelper(zAxisDirection, origin, length, 0x0000ff);

    arrowGroup.add(xAxisArrow);
    arrowGroup.add(yAxisArrow);
    arrowGroup.add(zAxisArrow);

    return arrowGroup;
}

export const getGroundPlane = (width: number, height: number, texture?:string): Promise<Mesh<THREE.PlaneGeometry, MeshStandardMaterial, Object3DEventMap>> => {
    return new Promise(resolve => {
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide });
        const loader = new THREE.TextureLoader();
        loader.load(texture || '/assets/textures/green-grass-textures.jpg',
            function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.offset.set(0, 0);
                texture.repeat.set(2, 2);
                material.map = texture;
                material.needsUpdate = true;
                const plane = new THREE.Mesh(geometry, material);
                plane.position.setY(0);
                plane.receiveShadow = true;
                plane.rotation.set(Math.PI / 2, 0, 0);

                //plane.rotation.set(-Math.PI/2, Math.PI/2000, Math.PI);
                plane.name = "plane";
                resolve(plane);
            });
    });
}


export const createShadowObject = async (reference: AssetObject): Promise<ShadowType> => {
    const config = {
        ...reference,
        color: "#3cffee",
    };
    switch (reference.type) {
        case "rect":
            (config as Rectangle).w = 50;
            (config as Rectangle).h = 50;
            break;
        case "circle":
            (config as Circle).radius = 25;
            break;
    }
    const shadowObject = await getMeshForItem(config) as ShadowType;
    shadowObject.refType = reference.type;
    shadowObject.name = "shadowObject";
    if (shadowObject.material) {
        (shadowObject.material as THREE.MeshBasicMaterial).opacity = 0.5;
        (shadowObject.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
    shadowObject.position.y = -100;
    return shadowObject;
}

export const isCollisionDetected = (object1: THREE.Object3D, object2: THREE.Object3D) => {
    const box1 = new THREE.Box3().setFromObject(object1);
    const box2 = new THREE.Box3().setFromObject(object2);

    return box1.intersectsBox(box2);
}