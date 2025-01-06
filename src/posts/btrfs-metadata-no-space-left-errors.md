# BTRFS Metadata and No space left errors

Before we start I wanted to give a bit of context about my data storage strategy.
My data is in two categories: important and reproducible data (can be easily recreated or retrieved).

I follow these rules as best practice:

 1. Important data must have 3 copies:
    - Local Network accessible copy
    - Local copy on cold storage
    - Offsite copy on cold storage
 2. Data integrity for important data is crucial
    - Using `squashfs` and then creating parity data of the archives using `par2` to mitigate bit-rot
 3. Full data integrity of reproducible data isn't important
    - I can accept bit-rot but not losing access to the files
    - Knowing a file is corrupt is important so that I can recreate or retrieve it.
 4. Local network data access must be fast and low latency
 5. Must not break the bank

## Local data server setup

[BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) was the best data storage format that fit the bill.

I created a storage pool consisting of two `4Tb` Hard Drives and two `8Tb` Hard Drives. The data is configured with the `RAID0` profile and the metadata is configured with `RAID1C4`. This allows data to benefit from the bandwidth of all 4 drives and is able to fill all the space on the drives (no storage loss). The configuration also guarantees that the metadata will not get corrupted, making it reliable for detecting bit-rot in my data. In addition to this configuration I made sure that each disk has `100Gb` of slack saved (this is a section of the disk that [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) will not use).

This setup has worked for me for over 6 years, and technically I started with just the 4Tb drives so [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) allowed me to grow my storage pool without any hiccups.

Recently I've run into a problem, all of a sudden my system put the storage pool into read-only mode and claimed it ran out of space.

## Diagnosis

When checking `dmesg`, [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) kindly printed out exactly what had happened. The data section still had free space and so did system however metadata had run out of space!

To confirm this I ran `sudo btrfs device usage /pool`
which allows you to see the current disk usage per device in the pool:

```bash
$ btrfs device usage /pool
/dev/sdc, ID: 1
   Device size:             3.64TiB
   Device slack:          100.00GiB
   Data,RAID0/4:            3.52TiB
   Metadata,RAID1C4:       17.03GiB
   System,RAID1C4:         32.00MiB
   Unallocated:             1.02MiB

/dev/sda, ID: 2
   Device size:             3.64TiB
   Device slack:          100.00GiB
   Data,RAID0/4:            3.52TiB
   Metadata,RAID1C4:       17.03GiB
   System,RAID1C4:         32.00MiB
   Unallocated:             1.02MiB

/dev/sdb, ID: 3
   Device size:             7.28TiB
   Device slack:          100.00GiB
   Data,RAID0/4:            3.52TiB
   Data,RAID0/2:          195.00GiB
   Metadata,RAID1C4:       17.03GiB
   System,RAID1C4:         32.00MiB
   Unallocated:             3.45TiB

/dev/sdf, ID: 4
   Device size:             7.28TiB
   Device slack:          100.00GiB
   Data,RAID0/4:            3.52TiB
   Data,RAID0/2:          195.00GiB
   Metadata,RAID1C4:       17.03GiB
   System,RAID1C4:         32.00MiB
   Unallocated:             3.45TiB
```

As you can see, the disk `sdc` and `sda` are full with only `1.02MiB` left unallocated. However, `sdf` and `sdb` still have plenty of space with `3.45TiB` unallocated.

To help me better understand the state of the disks I drew a diagram.
![raid1-c4](../assets/pool-raid1c4.jpg)

The first thing that stood out was the behavior of the `RAID1C4` profile for the metadata. It forces [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) to create 4 copies of the metadata, one on each disk. So when I tried to write new data to the storage pool [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) failed and in order to protect the data and the storage pool, it had set the pool to read-only.

## The fix

Fixing the issue was quite straight forward, but it required at least `1Gb` of free space on each disk in the pool.

I used `10Gb` from the slack section (the extra `100Gb` of unused disk space) to resize the disks `sdc` and `sda` (device IDs `1` and `2`) using the following commands:

`sudo btrfs filesystem resize 1:+10G /pool` and `sudo btrfs filesystem resize 2:+10G /pool`

*Caution this requires the pool to be mounted in read-write so you might have to umount the pool and remount it. See gotcha in the Conclusion.*

This provides some extra space that [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) can use to move chunks around when it converts the metadata profile from `RAID1C4` to `RAID1`.
`RAID1` guarantees that the metadata is stored on 2 disks instead of 4, removing our deadlock.

The command to convert the metadata profile is the following:

`sudo btrfs balance start -mconvert=raid1 /pool`

This will kick off a balance operation.

Once it is finished running `sudo btrfs device usage /pool` shows what changed:

```bash
$ btrfs device usage /pool
/dev/sdc, ID: 1
   Device size:             3.64TiB
   Device slack:           90.00GiB
   Data,RAID0/4:            3.52TiB
   Unallocated:            27.06GiB

/dev/sda, ID: 2
   Device size:             3.64TiB
   Device slack:           90.00GiB
   Data,RAID0/4:            3.52TiB
   Unallocated:            27.06GiB

/dev/sdb, ID: 3
   Device size:             7.28TiB
   Device slack:          100.00GiB
   Data,RAID0/4:            3.52TiB
   Data,RAID0/2:          195.00GiB
   Metadata,RAID1:         17.00GiB
   System,RAID1:           32.00MiB
   Unallocated:             3.45TiB

/dev/sdf, ID: 4
   Device size:             7.28TiB
   Device slack:          100.00GiB
   Data,RAID0/4:            3.52TiB
   Data,RAID0/2:          195.00GiB
   Metadata,RAID1:         17.00GiB
   System,RAID1:           32.00MiB
   Unallocated:             3.45TiB
```

Again to better visualize, this diagram represents the state after the balance operation:
![raid1](../assets/pool-raid1.jpg)

As you can see [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) removed the redundant copies of the metadata from the smaller disks and preserved it on the larger ones.

To clean up and reclaim the slack I ran the following commands:

`sudo btrfs filesystem resize 1:-10G /pool` and `sudo btrfs filesystem resize 2:-10G /pool`

## Conclusion

[BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html) is incredibly powerful and super configurable, so configurable that like me, you can easily set up a foot gun. But it also has all the tools needed to diagnose and fix it.

The main thing that saved me was the slack space as without it, I would have not been able to run a balance. I recommend this as a best practice for anyone running [BTRFS](https://btrfs.readthedocs.io/en/latest/Introduction.html).

Another gotcha to be aware of if the pool has less than `1Gb` of space, and you try to run a balance, the balance will fill the remaining space in the pool and cause it to switch to read-only mode.

It is impossible to cancel a balance once the pool gets into read-only mode. The only way to stop it is to reboot and make sure not to mount the pool on boot. Once booted, you can mount it with the `skip_balance` option (`sudo mount -o skip_balance  /dev/sdc /pool`) which will set the balance operation to `paused`. Use `sudo btrfs balance cancel /pool` to cancel it and proceed with resizing the pool.

###### Last updated 2023-11-2
